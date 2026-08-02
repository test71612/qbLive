import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/github";
import { getSessionUser } from "@/lib/session";
import { serviceClient } from "@/lib/supabase";
import type { TaskStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repo = request.nextUrl.searchParams.get("repo");
  if (!repo) {
    return NextResponse.json({ error: "repo is required" }, { status: 400 });
  }

  const { data, error } = await serviceClient()
    .from("tasks")
    .select("*")
    .eq("repo", repo)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { repo?: string; title?: string; filePaths?: string[] };
  const repo = body.repo?.trim();
  const title = body.title?.trim();
  if (!repo || !title) {
    return NextResponse.json({ error: "repo and title are required" }, { status: 400 });
  }

  const { data, error } = await serviceClient()
    .from("tasks")
    .insert({
      repo,
      title,
      file_paths: (body.filePaths ?? []).map((value) => value.trim()).filter(Boolean),
      created_by_github_username: user.login,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    repo,
    actor: user.login,
    action: "task_create",
    target: title,
  });

  return NextResponse.json({ task: data });
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    status?: TaskStatus;
    title?: string;
    filePaths?: string[];
  };
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) patch.status = body.status;
  if (body.title) patch.title = body.title.trim();
  if (body.filePaths) patch.file_paths = body.filePaths.map((value) => value.trim()).filter(Boolean);

  const { data, error } = await serviceClient().from("tasks").update(patch).eq("id", body.id).select("*").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    repo: data.repo,
    actor: user.login,
    action: "task_move",
    target: data.title,
    detail: { status: data.status },
  });

  return NextResponse.json({ task: data });
}
