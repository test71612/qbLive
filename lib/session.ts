import "server-only";

import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { env } from "@/lib/env";
import type { SessionUser } from "@/lib/types";

type SessionData = {
  user?: SessionUser;
  repo?: string;
};

export const sessionCookieName = "ops_hub_session";

const sessionOptions: SessionOptions = {
  cookieName: sessionCookieName,
  password: env.sessionSecret,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function getSessionUser() {
  const session = await getSession();
  return session.user ?? null;
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("unauthorized");
  }
  return user;
}
