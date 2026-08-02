import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/env";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  await session.destroy();
  return NextResponse.redirect(new URL("/", getAppBaseUrl(request.url)));
}
