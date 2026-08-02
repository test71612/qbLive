import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { exchangeGitHubCode, loadGitHubUser, upsertAppUser } from "@/lib/github";
import { encodeSession, sessionCookieName } from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", request.url));
  }

  try {
    const accessToken = await exchangeGitHubCode(code);
    const user = await loadGitHubUser(accessToken);
    await upsertAppUser(user);

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set({
      name: sessionCookieName,
      value: encodeSession({ user, repo: env.defaultRepo || "" }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    response.headers.set("x-session-saved", "true");
    response.headers.set("x-session-user", user.login);
    response.headers.set("x-session-origin", new URL(request.url).origin);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }
}
