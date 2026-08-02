import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET() {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.githubClientId);
  url.searchParams.set("redirect_uri", `${env.appUrl}/api/auth/callback`);
  url.searchParams.set("scope", "read:user repo");

  return NextResponse.redirect(url);
}
