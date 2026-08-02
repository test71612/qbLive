import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { SessionUser } from "@/lib/types";

type SessionData = {
  user?: SessionUser;
  repo?: string;
};

type Session = SessionData & {
  save: () => Promise<void>;
  destroy: () => Promise<void>;
};

export const sessionCookieName = "ops_hub_session";

function encodeSession(value: SessionData): string {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  const signature = createHmac("sha256", env.sessionSecret).update(payload).digest("hex");
  return `${signature}.${payload}`;
}

function decodeSession(value: string | undefined): SessionData | null {
  if (!value) return null;
  const separatorIndex = value.indexOf(".");
  if (separatorIndex === -1) return null;

  const signature = value.slice(0, separatorIndex);
  const payload = value.slice(separatorIndex + 1);
  const expectedSignature = createHmac("sha256", env.sessionSecret).update(payload).digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionData;
  } catch {
    return null;
  }
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  const storedValue = cookieStore.get(sessionCookieName)?.value;
  const decoded = decodeSession(storedValue) ?? {};

  const sessionState: SessionData = {
    user: decoded.user,
    repo: decoded.repo,
  };

  return {
    ...sessionState,
    async save() {
      const currentStore = await cookies();
      currentStore.set(sessionCookieName, encodeSession(sessionState), getCookieOptions());
    },
    async destroy() {
      const currentStore = await cookies();
      currentStore.delete(sessionCookieName);
    },
  };
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
