import "server-only";

import { Octokit } from "octokit";
import { env } from "@/lib/env";
import { serviceClient } from "@/lib/supabase";
import { parseRepo, decodeBase64 } from "@/lib/utils";
import type { GitHubCommit, GitHubFile, GitHubTreeNode, RepoRecord, Role, SessionUser } from "@/lib/types";

export function githubClient(accessToken: string) {
  return new Octokit({ auth: accessToken });
}

export function isOwner(login: string) {
  return Boolean(env.ownerGitHubUsername) && login.toLowerCase() === env.ownerGitHubUsername.toLowerCase();
}

export function resolveRole(login: string): Role {
  return isOwner(login) || env.adminGitHubUsernames.some((admin) => admin.toLowerCase() === login.toLowerCase())
    ? "admin"
    : "member";
}

export async function exchangeGitHubCode(code: string) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.githubClientId,
      client_secret: env.githubClientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange GitHub OAuth code");
  }

  const payload = (await response.json()) as { access_token?: string; error_description?: string };
  if (!payload.access_token) {
    throw new Error(payload.error_description ?? "Missing GitHub access token");
  }

  return payload.access_token;
}

export async function loadGitHubUser(accessToken: string): Promise<SessionUser> {
  const client = githubClient(accessToken);
  const { data } = await client.request("GET /user");
  return {
    login: data.login,
    name: data.name ?? data.login,
    avatarUrl: data.avatar_url,
    accessToken,
    role: resolveRole(data.login),
  };
}

type AppUserRow = {
  github_username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
  last_seen_at: string;
  created_at: string;
};

async function findAppUser(login: string) {
  const db = serviceClient();
  const { data, error } = await db
    .from("app_users")
    .select("github_username, display_name, avatar_url, role, last_seen_at, created_at")
    .ilike("github_username", login)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AppUserRow | null;
}

export async function isAppUserAllowed(login: string) {
  return isOwner(login) || Boolean(await findAppUser(login));
}

// A GitHub account is admitted only after an existing developer has added it.
// The configured owner is bootstrapped automatically, preventing first-login lockout.
export async function admitAndTouchAppUser(user: SessionUser): Promise<SessionUser> {
  const db = serviceClient();
  const existing = await findAppUser(user.login);
  if (!existing && !isOwner(user.login)) {
    throw new Error("access_denied");
  }

  const role = isOwner(user.login) ? "admin" : (existing?.role ?? resolveRole(user.login));
  const payload = {
    github_username: user.login,
    display_name: user.name,
    avatar_url: user.avatarUrl,
    role,
    last_seen_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await db.from("app_users").update(payload).eq("github_username", existing.github_username)
    : await db.from("app_users").insert(payload);
  if (error) throw new Error(error.message);

  return { ...user, role };
}

export async function touchAppUser(login: string) {
  const existing = await findAppUser(login);
  if (!existing) return false;
  const { error } = await serviceClient()
    .from("app_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("github_username", existing.github_username);
  if (error) throw new Error(error.message);
  return true;
}

export async function listAppUsers(): Promise<AppUserRow[]> {
  const { data, error } = await serviceClient()
    .from("app_users")
    .select("github_username, display_name, avatar_url, role, last_seen_at, created_at")
    .order("last_seen_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AppUserRow[];
}

export async function addAppUser(accessToken: string, rawLogin: string) {
  const login = rawLogin.trim().replace(/^@/, "");
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login)) {
    throw new Error("invalid_github_username");
  }

  const client = githubClient(accessToken);
  const { data: profile } = await client.request("GET /users/{username}", { username: login });
  const existing = await findAppUser(profile.login);
  const role = isOwner(profile.login) ? "admin" : (existing?.role ?? resolveRole(profile.login));
  const payload = {
    github_username: profile.login,
    display_name: profile.name ?? profile.login,
    avatar_url: profile.avatar_url,
    role,
    last_seen_at: existing?.last_seen_at ?? new Date().toISOString(),
  };
  const db = serviceClient();
  const { error } = existing
    ? await db.from("app_users").update(payload).eq("github_username", existing.github_username)
    : await db.from("app_users").insert(payload);
  if (error) throw new Error(error.message);
  return payload;
}

export async function removeAppUser(login: string) {
  const existing = await findAppUser(login);
  if (!existing) return;
  const db = serviceClient();
  const { error: reposError } = await db.from("repos").update({ added_by: null }).eq("added_by", existing.github_username);
  if (reposError) throw new Error(reposError.message);
  const { error } = await db.from("app_users").delete().eq("github_username", existing.github_username);
  if (error) throw new Error(error.message);
}

export async function listConnectedRepos() {
  const db = serviceClient();
  const { data, error } = await db.from("repos").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listAvailableRepos(): Promise<RepoRecord[]> {
  const repos = (await listConnectedRepos()) as RepoRecord[];

  if (!env.defaultRepo || repos.some((repo) => repo.repo === env.defaultRepo)) {
    return repos;
  }

  return [
    {
      repo: env.defaultRepo,
      label: "المستودع الافتراضي",
      added_by: null,
      created_at: new Date(0).toISOString(),
    },
    ...repos,
  ];
}

export async function fetchRepoTree(accessToken: string, repoId: string): Promise<GitHubTreeNode[]> {
  const client = githubClient(accessToken);
  const { owner, repo } = parseRepo(repoId);
  const repoInfo = await client.request("GET /repos/{owner}/{repo}", { owner, repo });
  const branch = repoInfo.data.default_branch;
  const refResponse = await client.request("GET /repos/{owner}/{repo}/git/refs/heads/{branch}", {
    owner,
    repo,
    branch,
  });
  const commitSha = refResponse.data.object?.sha;

  if (!commitSha) {
    throw new Error("Failed to resolve default branch commit");
  }

  const tree = await client.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
    owner,
    repo,
    tree_sha: commitSha,
    recursive: "1",
  });

  return (tree.data.tree ?? [])
    .filter((node) => node.path && (node.type === "blob" || node.type === "tree"))
    .map((node) => ({
      path: node.path!,
      type: node.type as "blob" | "tree",
    }));
}

export async function fetchFile(accessToken: string, repoId: string, filePath: string, ref?: string): Promise<GitHubFile> {
  const client = githubClient(accessToken);
  const { owner, repo } = parseRepo(repoId);
  const response = await client.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path: filePath,
    ref,
  });

  if (Array.isArray(response.data) || response.data.type !== "file" || !response.data.content) {
    throw new Error("Path is not a file");
  }

  return {
    path: filePath,
    content: decodeBase64(response.data.content.replace(/\n/g, "")),
    sha: response.data.sha,
  };
}

export async function updateGitHubFile(accessToken: string, repoId: string, filePath: string, content: string, sha: string, message: string) {
  const client = githubClient(accessToken);
  const { owner, repo } = parseRepo(repoId);
  const response = await client.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path: filePath,
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    sha,
  });
  return { commitSha: response.data.commit.sha, url: response.data.commit.html_url };
}

export async function createGitHubFile(accessToken: string, repoId: string, filePath: string, content: string, message: string) {
  const client = githubClient(accessToken);
  const { owner, repo } = parseRepo(repoId);
  const response = await client.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path: filePath,
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
  });
  return { commitSha: response.data.commit.sha, url: response.data.commit.html_url };
}

export async function deleteGitHubFile(accessToken: string, repoId: string, filePath: string, sha: string, message: string) {
  const client = githubClient(accessToken);
  const { owner, repo } = parseRepo(repoId);
  const response = await client.request("DELETE /repos/{owner}/{repo}/contents/{path}", { owner, repo, path: filePath, sha, message });
  return { commitSha: response.data.commit.sha, url: response.data.commit.html_url };
}

export async function fetchCommits(accessToken: string, repoId: string, path?: string, limit = 10): Promise<GitHubCommit[]> {
  const client = githubClient(accessToken);
  const { owner, repo } = parseRepo(repoId);
  const { data } = await client.request("GET /repos/{owner}/{repo}/commits", {
    owner,
    repo,
    path,
    per_page: limit,
  });

  return data.map((commit) => ({
    sha: commit.sha.slice(0, 7),
    fullSha: commit.sha,
    message: commit.commit.message.split("\n")[0] ?? commit.sha.slice(0, 7),
    author: commit.commit.author?.name ?? commit.author?.login ?? "unknown",
    date: commit.commit.author?.date ?? new Date().toISOString(),
    url: commit.html_url,
  }));
}

export async function logAuditEvent(args: {
  repo?: string | null;
  actor?: string | null;
  action: string;
  target?: string | null;
  detail?: Record<string, unknown>;
}) {
  const db = serviceClient();
  await db.from("audit_log").insert({
    repo: args.repo ?? null,
    actor: args.actor ?? null,
    action: args.action,
    target: args.target ?? null,
    detail: args.detail ?? null,
  });
}
