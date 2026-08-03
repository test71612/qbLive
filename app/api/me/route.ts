import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { listAvailableRepos } from "@/lib/github";
import { encodeSession, getCookieOptions, getSession, getSessionUser, sessionCookieName } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const session = await getSession();
  const repos = await listAvailableRepos();

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
  const repo = body.repo?.trim() ?? "";
  const session = await getSession();
  const response = NextResponse.json({ status: "ok" });
  response.cookies.set(
    sessionCookieName,
    encodeSession({ user: session.user, repo }),
    getCookieOptions(request.url),
  );

  return response;
}
