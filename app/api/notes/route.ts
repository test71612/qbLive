import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/github";
import { getSessionUser } from "@/lib/session";
import { serviceClient } from "@/lib/supabase";

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

  const { data, error } = await serviceClient()
    .from("file_notes")
    .select("*")
    .eq("repo", repo)
    .eq("file_path", filePath)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ note: data });
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { repo?: string; path?: string; note?: string };
  const repo = body.repo?.trim();
  const filePath = body.path?.trim();
  const note = body.note?.trim();
  if (!repo || !filePath || !note) {
    return NextResponse.json({ error: "repo, path and note are required" }, { status: 400 });
  }

  const { data, error } = await serviceClient()
    .from("file_notes")
    .upsert({
      repo,
      file_path: filePath,
      note,
      updated_by: user.login,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    repo,
    actor: user.login,
    action: "note_edit",
    target: filePath,
  });

  return NextResponse.json({ note: data });
}
