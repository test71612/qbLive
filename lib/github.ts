import "server-only";

import { Octokit } from "octokit";
import { env } from "@/lib/env";
import { serviceClient } from "@/lib/supabase";
import { parseRepo, decodeBase64 } from "@/lib/utils";
import type { GitHubCommit, GitHubFile, GitHubTreeNode, RepoRecord, Role, SessionUser } from "@/lib/types";

export function githubClient(accessToken: string) {
  return new Octokit({ auth: accessToken });
}

export function resolveRole(login: string): Role {
  return env.adminGitHubUsernames.includes(login) ? "admin" : "member";
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

export async function upsertAppUser(user: SessionUser) {
  const db = serviceClient();
  await db.from("app_users").upsert({
    github_username: user.login,
    display_name: user.name,
    avatar_url: user.avatarUrl,
    role: user.role,
    last_seen_at: new Date().toISOString(),
  });
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

export async function fetchFile(accessToken: string, repoId: string, filePath: string): Promise<GitHubFile> {
  const client = githubClient(accessToken);
  const { owner, repo } = parseRepo(repoId);
  const response = await client.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path: filePath,
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
