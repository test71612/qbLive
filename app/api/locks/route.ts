import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logAuditEvent } from "@/lib/github";
import { getSessionUser } from "@/lib/session";
import { serviceClient } from "@/lib/supabase";
import { overlap } from "@/lib/utils";
import type { FileLock } from "@/lib/types";

async function expireStaleLocks() {
  const cutoff = new Date(Date.now() - env.lockIdleHours * 60 * 60 * 1000).toISOString();
  const db = serviceClient();
  const { data } = await db
    .from("file_locks")
    .update({
      released_at: new Date().toISOString(),
      released_by: "system:idle",
    })
    .is("released_at", null)
    .lt("last_active_at", cutoff)
    .select("id, repo, locked_by_github_username, file_paths");

  for (const lock of data ?? []) {
    await logAuditEvent({
      repo: lock.repo as string,
      actor: "system",
      action: "release_idle",
      target: ((lock.file_paths as string[]) ?? []).join(", "),
      detail: { lockId: lock.id, owner: lock.locked_by_github_username },
    });
  }
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await expireStaleLocks();
  const repo = request.nextUrl.searchParams.get("repo");
  const db = serviceClient();
  let query = db.from("file_locks").select("*").is("released_at", null).order("created_at", { ascending: false });
  if (repo) {
    query = query.eq("repo", repo);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ locks: (data ?? []) as FileLock[] });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    repo?: string;
    filePaths?: string[];
    reason?: string;
    force?: boolean;
  };

  const repo = body.repo?.trim();
  const filePaths = (body.filePaths ?? []).map((value) => value.trim()).filter(Boolean);
  const reason = body.reason?.trim();
  if (!repo || filePaths.length === 0 || !reason) {
    return NextResponse.json({ error: "repo, filePaths and reason are required" }, { status: 400 });
  }

  const db = serviceClient();
  const { data: active } = await db.from("file_locks").select("*").eq("repo", repo).is("released_at", null);
  const conflicts = ((active ?? []) as FileLock[])
    .filter((lock) => lock.locked_by_github_username !== user.login)
    .map((lock) => ({ lock, files: overlap(filePaths, lock.file_paths) }))
    .filter((item) => item.files.length > 0);

  if (conflicts.length > 0 && !body.force) {
    return NextResponse.json({ status: "conflict", conflicts }, { status: 409 });
  }

  const { data, error } = await db
    .from("file_locks")
    .insert({
      repo,
      file_paths: filePaths,
      locked_by_github_username: user.login,
      reason,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    repo,
    actor: user.login,
    action: "claim",
    target: filePaths.join(", "),
    detail: {
      reason,
      forcedOver: conflicts.map((item) => item.lock.locked_by_github_username),
    },
  });

  return NextResponse.json({ lock: data, conflicts });
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; action?: "release" | "heartbeat" };
  if (!body.id || !body.action) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }

  const db = serviceClient();
  const { data: lock, error } = await db.from("file_locks").select("*").eq("id", body.id).maybeSingle();
  if (error || !lock) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const isOwner = lock.locked_by_github_username === user.login;
  const isAdmin = user.role === "admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (body.action === "heartbeat") {
    await db.from("file_locks").update({ last_active_at: new Date().toISOString() }).eq("id", body.id);
    return NextResponse.json({ status: "ok" });
  }

  await db
    .from("file_locks")
    .update({
      released_at: new Date().toISOString(),
      released_by: user.login,
    })
    .eq("id", body.id)
    .is("released_at", null);

  await logAuditEvent({
    repo: lock.repo,
    actor: user.login,
    action: isOwner ? "release" : "force_release",
    target: (lock.file_paths as string[]).join(", "),
    detail: { owner: lock.locked_by_github_username, lockId: body.id },
  });

  return NextResponse.json({ status: "ok" });
}
