import { NextRequest, NextResponse } from "next/server";
import { consumeSessionHandoff, encodeSession, getCookieOptions, sessionCookieName } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { session?: string };
  const session = consumeSessionHandoff(body.session);

  if (!session?.user) {
    return NextResponse.json({ error: "invalid_session_handoff" }, { status: 401 });
  }

  const response = NextResponse.json({ status: "ok" });
  response.cookies.set(sessionCookieName, encodeSession(session), getCookieOptions(request.url));
  return response;
}
