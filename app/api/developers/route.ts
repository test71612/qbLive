import { NextRequest, NextResponse } from "next/server";
import { addAppUser, isOwner, listAppUsers, logAuditEvent, removeAppUser, touchAppUser } from "@/lib/github";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/session";
import { serviceClient } from "@/lib/supabase";

const onlineWindowMs = 3 * 60 * 1000;

type ActiveLockRow = {
  repo: string;
  file_paths: string[];
  locked_by_github_username: string;
  reason: string;
  last_active_at: string;
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [developers, locksResult] = await Promise.all([
    listAppUsers(),
    serviceClient()
      .from("file_locks")
      .select("repo, file_paths, locked_by_github_username, reason, last_active_at")
      .is("released_at", null),
  ]);

  if (locksResult.error) return NextResponse.json({ error: locksResult.error.message }, { status: 500 });

  const now = Date.now();
  const activeLocks = ((locksResult.data ?? []) as ActiveLockRow[]).filter(
    (lock) => now - new Date(lock.last_active_at).getTime() < env.lockIdleHours * 60 * 60 * 1000,
  );

  return NextResponse.json({
    ownerLogin: env.ownerGitHubUsername,
    canDelete: isOwner(user.login),
    developers: developers.map((developer) => {
      const workingOn = activeLocks
        .filter((lock) => lock.locked_by_github_username.toLowerCase() === developer.github_username.toLowerCase())
        .map((lock) => ({ repo: lock.repo, paths: lock.file_paths, reason: lock.reason, lastActiveAt: lock.last_active_at }));
      return {
        login: developer.github_username,
        name: developer.display_name || developer.github_username,
        avatarUrl: developer.avatar_url,
        role: developer.role,
        lastSeenAt: developer.last_seen_at,
        online: now - new Date(developer.last_seen_at).getTime() < onlineWindowMs,
        workingOn,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as { login?: string };
  if (!body.login?.trim()) return NextResponse.json({ error: "github_username_required" }, { status: 400 });

  try {
    const developer = await addAppUser(user.accessToken, body.login);
    await logAuditEvent({ actor: user.login, action: "developer_add", target: developer.github_username });
    return NextResponse.json({ developer }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "developer_add_failed";
    const status = message === "invalid_github_username" ? 400 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isOwner(user.login)) return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const body = (await request.json()) as { login?: string };
  const login = body.login?.trim();
  if (!login) return NextResponse.json({ error: "github_username_required" }, { status: 400 });
  if (isOwner(login)) return NextResponse.json({ error: "owner_cannot_be_removed" }, { status: 400 });

  try {
    await removeAppUser(login);
    await logAuditEvent({ actor: user.login, action: "developer_remove", target: login });
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "developer_remove_failed" }, { status: 500 });
  }
}

export async function PATCH() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await touchAppUser(user.login);
  return NextResponse.json({ status: "ok" });
}
