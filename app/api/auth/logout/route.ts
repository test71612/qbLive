import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/env";
import { getCookieOptions, sessionCookieName } from "@/lib/session";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", getAppBaseUrl(request.url)));
  response.cookies.set(sessionCookieName, "", { ...getCookieOptions(request.url), maxAge: 0 });
  return response;
}
