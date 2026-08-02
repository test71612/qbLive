import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { exchangeGitHubCode, loadGitHubUser, upsertAppUser } from "@/lib/github";
import { encodeSession, getCookieOptions, sessionCookieName } from "@/lib/session";

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
    const user = await loadGitHubUser(accessToken);
    await upsertAppUser(user);

    const cookieOptions = getCookieOptions(request.url);

    const response = NextResponse.redirect(new URL("/dashboard", request.url));

    // Use the built-in cookies API instead of hand-building the Set-Cookie
    // header string — avoids formatting mistakes and lets Next.js handle
    // encoding/serialization consistently across runtimes.
    response.cookies.set(
      sessionCookieName,
      encodeSession({ user, repo: env.defaultRepo || "" }),
      cookieOptions,
    );

    // Belt-and-suspenders: make sure no intermediate cache (CDN/proxy) stores
    // this response and replays someone else's session cookie.
    response.headers.set("Cache-Control", "no-store");

    // Debug headers — safe to remove once the host-mismatch theory is confirmed.
    response.headers.set("x-session-saved", "true");
    response.headers.set("x-session-user", user.login);
    response.headers.set("x-session-origin", new URL(request.url).origin);

    return response;
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }
}
