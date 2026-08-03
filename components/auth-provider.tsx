"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RepoRecord, SessionUser } from "@/lib/types";

type AuthContextValue = {
  user: SessionUser | null;
  repos: RepoRecord[];
  currentRepo: string;
  loading: boolean;
  updateRepo: (repo: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const storageKey = "ops_hub_session";
let browserFetch: typeof window.fetch | null = null;

function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = window.localStorage.getItem(storageKey);
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return (browserFetch ?? window.fetch)(input, { ...init, headers });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [repos, setRepos] = useState<RepoRecord[]>([]);
  const [currentRepo, setCurrentRepo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const originalFetch = window.fetch;
    browserFetch = originalFetch;
    window.fetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
      if (typeof input === "string" && input.startsWith("/api/") && !input.startsWith("/api/auth/")) {
        return authorizedFetch(input, init);
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;

    void authorizedFetch("/api/me")
      .then(async (response) => {
        if (!response.ok) {
          window.localStorage.removeItem(storageKey);
          router.replace("/");
          return;
        }
        const payload = (await response.json()) as { user: SessionUser; repos: RepoRecord[]; repo: string };
        setUser(payload.user);
        setRepos(payload.repos);
        setCurrentRepo(payload.repo);
        setLoading(false);
      })
      .catch(() => router.replace("/"));

    const presenceTimer = window.setInterval(() => {
      void authorizedFetch("/api/developers/presence", { method: "PATCH" });
    }, 60_000);
    void authorizedFetch("/api/developers/presence", { method: "PATCH" });

    return () => {
      window.clearInterval(presenceTimer);
      window.fetch = originalFetch;
      browserFetch = null;
    };
  }, [router]);

  const updateRepo = useCallback(async (repo: string) => {
    const response = await authorizedFetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo }),
    });
    const payload = (await response.json()) as { token?: string };
    if (payload.token) window.localStorage.setItem(storageKey, payload.token);
    setCurrentRepo(repo);
  }, []);

  return <AuthContext.Provider value={{ user, repos, currentRepo, loading, updateRepo }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
