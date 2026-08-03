import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import type { SessionUser } from "@/lib/types";

type SessionData = {
  user?: SessionUser;
  repo?: string;
};

type SessionHandoff = SessionData & {
  expiresAt: number;
};

type Session = SessionData & {
  save: () => Promise<void>;
  destroy: () => Promise<void>;
};

export const sessionCookieName = "ops_hub_session";

export function encodeSession(value: SessionData | SessionHandoff): string {
  const key = createHash("sha256").update(env.sessionSecret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${payload.toString("base64url")}`;
}

function decodeSession(value: string | undefined): SessionData | null {
  if (!value) return null;
  const [iv, tag, payload] = value.split(".");
  if (!iv || !tag || !payload) return null;

  try {
    const key = createHash("sha256").update(env.sessionSecret).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(payload, "base64url")), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as SessionData;
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

export function createSessionHandoff(value: SessionData): string {
  return encodeSession({ ...value, expiresAt: Date.now() + 60_000 });
}

export function consumeSessionHandoff(value: string | undefined): SessionData | null {
  const decoded = decodeSession(value) as SessionHandoff | null;

  if (!decoded || !Number.isFinite(decoded.expiresAt) || decoded.expiresAt < Date.now()) {
    return null;
  }

  return { user: decoded.user, repo: decoded.repo };
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
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const storedValue = bearerToken ?? cookieStore.get(sessionCookieName)?.value;
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
