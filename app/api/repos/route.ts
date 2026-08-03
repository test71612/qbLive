import { NextRequest, NextResponse } from "next/server";
import { listAvailableRepos, logAuditEvent } from "@/lib/github";
import { getSessionUser } from "@/lib/session";
import { serviceClient } from "@/lib/supabase";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repos = await listAvailableRepos();
  return NextResponse.json({ repos });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { repo?: string; label?: string };
  const repo = body.repo?.trim();
  if (!repo) {
    return NextResponse.json({ error: "repo is required" }, { status: 400 });
  }

  const db = serviceClient();
  const { data, error } = await db
    .from("repos")
    .upsert({
      repo,
      label: body.label?.trim() || null,
      added_by: user.login,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    repo,
    actor: user.login,
    action: "repo_add",
    target: repo,
  });

  return NextResponse.json({ repo: data });
}
