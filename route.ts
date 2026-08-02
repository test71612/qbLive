import { NextResponse, type NextRequest } from "next/server";
import { LOCK_IDLE_HOURS } from "@/lib/env";
import { getSession } from "@/lib/session";
import { serviceClient } from "@/lib/supabase";
import { overlap } from "@/lib/utils";
import type { FileLock } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Releases claims nobody has touched for LOCK_IDLE_HOURS so the board stays honest. */
async function expireStale(): Promise<void> {
  const cutoff = new Date(Date.now() - LOCK_IDLE_HOURS() * 3600_000).toISOString();
  const db = serviceClient();
  const { data } = await db
    .from("file_locks")
    .update({ released_at: new Date().toISOString(), released_by: "system:idle" })
    .is("released_at", null)
    .lt("last_active_at", cutoff)
    .select("id, repo, locked_by_github_username, file_paths");

  if (data?.length) {
    await db.from("audit_log").insert(
      data.map((l) => ({
        repo: l.repo,
        actor: "system",
        action: "release_idle",
        target: (l.file_paths as string[]).join(", "),
        detail: { lock_id: l.id, was: l.locked_by_github_username },
      })),
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await expireStale();

  const repo = req.nextUrl.searchParams.get("repo");
  let query = serviceClient()
    .from("file_locks")
    .select("*")
    .is("released_at", null)
    .order("created_at", { ascending: false });
  if (repo) query = query.eq("repo", repo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ locks: (data ?? []) as FileLock[] });
}

/** Claim files. Never hard-blocks: returns the conflicts so the UI can warn,
 *  and only proceeds when the user has seen them and sent force: true. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { repo?: string; filePaths?: string[]; reason?: string; force?: boolean };
  const repo = body.repo?.trim();
  const filePaths = (body.filePaths ?? []).map((p) => p.trim()).filter(Boolean);
  const reason = body.reason?.trim();

  if (!repo || filePaths.length === 0) return NextResponse.json({ error: "repo and filePaths are required" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "reason is required" }, { status: 400 });

  const db = serviceClient();
  const { data: active } = await db.from("file_locks").select("*").eq("repo", repo).is("released_at", null);

  const conflicts = ((active ?? []) as FileLock[])
    .filter((l) => l.locked_by_github_username !== session.login)
    .map((l) => ({ lock: l, files: overlap(filePaths, l.file_paths) }))
    .filter((c) => c.files.length > 0);

  if (conflicts.length > 0 && !body.force) {
    return NextResponse.json({ status: "conflict", conflicts }, { status: 409 });
  }

  const { data, error } = await db
    .from("file_locks")
    .insert({
      repo,
      file_paths: filePaths,
      locked_by_github_username: session.login,
      reason,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("audit_log").insert({
    repo,
    actor: session.login,
    action: "claim",
    target: filePaths.join(", "),
    detail: { reason, forced_over: conflicts.map((c) => c.lock.locked_by_github_username) },
  });

  return NextResponse.json({ status: "ok", lock: data, warnedAbout: conflicts });
}

/** action: "release" (owner or admin) | "heartbeat" (owner, keeps a claim alive). */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, action } = (await req.json()) as { id?: string; action?: "release" | "heartbeat" };
  if (!id || !action) return NextResponse.json({ error: "id and action are required" }, { status: 400 });

  const db = serviceClient();
  const { data: lock } = await db.from("file_locks").select("*").eq("id", id).maybeSingle();
  if (!lock) return NextResponse.json({ error: "not found" }, { status: 404 });

  const isOwner = lock.locked_by_github_username === session.login;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (action === "heartbeat") {
    await db.from("file_locks").update({ last_active_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ status: "ok" });
  }

  await db
    .from("file_locks")
    .update({ released_at: new Date().toISOString(), released_by: session.login })
    .eq("id", id)
    .is("released_at", null);

  await db.from("audit_log").insert({
    repo: lock.repo,
    actor: session.login,
    action: isOwner ? "release" : "force_release",
    target: (lock.file_paths as string[]).join(", "),
    detail: { lock_id: id, owner: lock.locked_by_github_username },
  });

  return NextResponse.json({ status: "ok" });
}
