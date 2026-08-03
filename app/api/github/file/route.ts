import { NextRequest, NextResponse } from "next/server";
import { createGitHubFile, deleteGitHubFile, fetchFile, logAuditEvent, updateGitHubFile } from "@/lib/github";
import { getSessionUser } from "@/lib/session";

function githubErrorResponse(error: unknown, fallbackStatus: number) {
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number"
    ? error.status
    : fallbackStatus;
  const message = error instanceof Error ? error.message : "github_error";
  return NextResponse.json({ error: message }, { status: status >= 400 && status < 600 ? status : fallbackStatus });
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repo = request.nextUrl.searchParams.get("repo");
  const filePath = request.nextUrl.searchParams.get("path");
  if (!repo || !filePath) {
    return NextResponse.json({ error: "repo and path are required" }, { status: 400 });
  }

  try {
    const file = await fetchFile(user.accessToken, repo, filePath, request.nextUrl.searchParams.get("ref") ?? undefined);
    return NextResponse.json(file);
  } catch (error) {
    return githubErrorResponse(error, 502);
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as { repo?: string; path?: string; content?: string; sha?: string; message?: string };
  if (!body.repo || !isSafePath(body.path) || typeof body.content !== "string" || !body.sha || !body.message?.trim()) {
    return NextResponse.json({ error: "repo_path_content_sha_and_message_required" }, { status: 400 });
  }

  try {
    const result = await updateGitHubFile(user.accessToken, body.repo, body.path!, body.content, body.sha, `@${user.login}: ${body.message.trim()}`);
    await logAuditEvent({ repo: body.repo, actor: user.login, action: "push", target: body.path, detail: { commitSha: result.commitSha, source: "qb_team_editor" } });
    return NextResponse.json(result);
  } catch (error) {
    return githubErrorResponse(error, 409);
  }
}

function isSafePath(path: string | undefined) {
  return Boolean(path && !path.startsWith("/") && !path.split("/").includes(".."));
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as { repo?: string; path?: string; content?: string; message?: string };
  if (!body.repo || !isSafePath(body.path) || typeof body.content !== "string" || !body.message?.trim()) return NextResponse.json({ error: "repo_path_content_and_message_required" }, { status: 400 });
  try {
    const result = await createGitHubFile(user.accessToken, body.repo, body.path!, body.content || "\n", `@${user.login}: ${body.message.trim()}`);
    await logAuditEvent({ repo: body.repo, actor: user.login, action: "file_create", target: body.path, detail: { commitSha: result.commitSha } });
    return NextResponse.json(result);
  } catch (error) {
    return githubErrorResponse(error, 409);
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as { repo?: string; path?: string; sha?: string; message?: string };
  if (!body.repo || !isSafePath(body.path) || !body.sha || !body.message?.trim()) return NextResponse.json({ error: "repo_path_sha_and_message_required" }, { status: 400 });
  try {
    const result = await deleteGitHubFile(user.accessToken, body.repo, body.path!, body.sha, `@${user.login}: ${body.message.trim()}`);
    await logAuditEvent({ repo: body.repo, actor: user.login, action: "file_delete", target: body.path, detail: { commitSha: result.commitSha } });
    return NextResponse.json(result);
  } catch (error) {
    return githubErrorResponse(error, 409);
  }
}
