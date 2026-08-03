import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { admitAndTouchAppUser, exchangeGitHubCode, loadGitHubUser } from "@/lib/github";
import { createSessionHandoff } from "@/lib/session";

// Make sure this route is never statically optimized/cached — it must run
// per-request and must never have its Set-Cookie response reused across users.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", request.url));
  }

  try {
    const accessToken = await exchangeGitHubCode(code);
    const githubUser = await loadGitHubUser(accessToken);
    const user = await admitAndTouchAppUser(githubUser);

    const completionUrl = new URL("/auth/complete", request.url);
    completionUrl.hash = `session=${encodeURIComponent(createSessionHandoff({ user, repo: env.defaultRepo || "" }))}`;
    const response = NextResponse.redirect(completionUrl);

    // Belt-and-suspenders: make sure no intermediate cache (CDN/proxy) stores
    // this response and replays someone else's session cookie.
    response.headers.set("Cache-Control", "no-store");

    // Debug headers — safe to remove once the host-mismatch theory is confirmed.
    response.headers.set("x-session-saved", "handoff");
    response.headers.set("x-session-user", user.login);
    response.headers.set("x-session-origin", new URL(request.url).origin);

    return response;
  } catch (error) {
    const code = error instanceof Error && error.message === "access_denied" ? "access_denied" : "oauth_failed";
    return NextResponse.redirect(new URL(`/?error=${code}`, request.url));
  }
}
