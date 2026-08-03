import { NextRequest, NextResponse } from "next/server";
import { fetchFile, logAuditEvent, updateGitHubFile } from "@/lib/github";
import { getSessionUser } from "@/lib/session";

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
    return NextResponse.json({ error: error instanceof Error ? error.message : "github_error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as { repo?: string; path?: string; content?: string; sha?: string; message?: string };
  if (!body.repo || !body.path || typeof body.content !== "string" || !body.sha || !body.message?.trim()) {
    return NextResponse.json({ error: "repo_path_content_sha_and_message_required" }, { status: 400 });
  }

  try {
    const result = await updateGitHubFile(user.accessToken, body.repo, body.path, body.content, body.sha, body.message.trim());
    await logAuditEvent({ repo: body.repo, actor: user.login, action: "push", target: body.path, detail: { commitSha: result.commitSha, source: "qb_team_editor" } });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "github_update_failed" }, { status: 409 });
  }
}
