import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { exchangeGitHubCode, loadGitHubUser, upsertAppUser } from "@/lib/github";
import { encodeSession, getCookieOptions, sessionCookieName } from "@/lib/session";

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
    const cookieValue = [
      `${sessionCookieName}=${encodeSession({ user, repo: env.defaultRepo || "" })}`,
      "Path=/",
      `Max-Age=${cookieOptions.maxAge}`,
      "HttpOnly",
      "SameSite=Lax",
      ...(cookieOptions.secure ? ["Secure"] : []),
    ].join(";");

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.headers.append("set-cookie", cookieValue);
    response.headers.set("x-session-saved", "true");
    response.headers.set("x-session-user", user.login);
    response.headers.set("x-session-origin", new URL(request.url).origin);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }
}
