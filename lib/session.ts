import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
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

export function encodeSession(value: SessionData): string {
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

export function getCookieOptions(requestUrl?: string) {
  const isSecure = requestUrl ? new URL(requestUrl).protocol === "https:" : process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

function inferRequestProtocol(host: string | null, forwardedProto: string | null) {
  if (forwardedProto) {
    return forwardedProto;
  }

  if (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")) {
    return "http";
  }

  try {
    return new URL(env.appUrl).protocol.replace(":", "") || (process.env.NODE_ENV === "production" ? "https" : "http");
  } catch {
    return process.env.NODE_ENV === "production" ? "https" : "http";
  }
}

// Best-effort way to recover the current request's origin when no explicit
// requestUrl is passed in (e.g. from a Server Action rather than a Route
// Handler). Falls back to env.appUrl if headers aren't available.
async function currentRequestUrl(): Promise<string | undefined> {
  try {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const proto = inferRequestProtocol(host, headerStore.get("x-forwarded-proto"));
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() not available in this context — fall through.
  }
  return env.appUrl || undefined;
}

export async function writeSessionCookie(value: SessionData, requestUrl?: string) {
  const currentStore = await cookies();
  currentStore.set(sessionCookieName, encodeSession(value), getCookieOptions(requestUrl));
}

export async function clearSessionCookie() {
  const currentStore = await cookies();
  currentStore.delete(sessionCookieName);
}

export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  const storedValue = cookieStore.get(sessionCookieName)?.value;
  const decoded = decodeSession(storedValue) ?? {};

  const sessionState: SessionData = {
    user: decoded.user,
    repo: decoded.repo,
  };

  const session: Session = {
    ...sessionState,
    async save() {
      const requestUrl = await currentRequestUrl();
      await writeSessionCookie({ user: session.user, repo: session.repo }, requestUrl);
    },
    async destroy() {
      await clearSessionCookie();
    },
  };

  return session;
}

export async function getSessionCookieStatus(): Promise<"missing" | "invalid" | "valid"> {
  const cookieStore = await cookies();
  const storedValue = cookieStore.get(sessionCookieName)?.value;

  if (!storedValue) {
    return "missing";
  }

  return decodeSession(storedValue) ? "valid" : "invalid";
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
