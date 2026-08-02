import { NextRequest, NextResponse } from "next/server";
import { env, getAppBaseUrl } from "@/lib/env";

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request.url);
  const redirectUri = `${baseUrl}/api/auth/callback`;
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.githubClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user repo");

  return NextResponse.redirect(url);
}
