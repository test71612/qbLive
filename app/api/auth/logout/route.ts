import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  await session.destroy();
  return NextResponse.redirect(new URL("/", env.appUrl));
}
