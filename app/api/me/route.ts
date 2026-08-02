import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { listConnectedRepos } from "@/lib/github";
import { getSession, getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const session = await getSession();
  const repos = await listConnectedRepos();

  return NextResponse.json({
    user,
    repos,
    repo: session.repo || env.defaultRepo || repos[0]?.repo || "",
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { repo?: string };
  const session = await getSession();
  session.repo = body.repo?.trim() ?? "";
  await session.save();

  return NextResponse.json({ status: "ok" });
}
