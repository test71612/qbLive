"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { RepoRecord, SessionUser } from "@/lib/types";

type AppShellProps = {
  user: SessionUser;
  repos: RepoRecord[];
  currentRepo: string;
  children: React.ReactNode;
};

const links = [
  { href: "/dashboard", label: "اللوحة" },
  { href: "/explorer", label: "المستكشف" },
  { href: "/tasks", label: "المهام" },
];

export function AppShell({ user, repos, currentRepo, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [selectedRepo, setSelectedRepo] = useState(currentRepo);
  const [isPending, startTransition] = useTransition();

  async function updateRepo(repo: string) {
    setSelectedRepo(repo);
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="shell">
      <header className="card mb-6 flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">
            OH
          </div>
          <div>
            <p className="text-lg font-bold">لوحة العمليات</p>
            <p className="text-sm muted">تنسيق العمل على الملفات بدون تضارب صامت.</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2 lg:ms-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold transition",
                pathname === link.href ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="grid gap-3 lg:ms-auto lg:grid-cols-[260px_auto] lg:items-center">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">المستودع الحالي</span>
            <select
              className="input"
              value={selectedRepo}
              onChange={(event) => void updateRepo(event.target.value)}
              disabled={isPending || repos.length === 0}
            >
              {repos.length === 0 && <option value="">لا يوجد مستودع بعد</option>}
              {repos.map((repo) => (
                <option key={repo.repo} value={repo.repo}>
                  {repo.label ? `${repo.label} - ${repo.repo}` : repo.repo}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-3 lg:justify-end">
            <img src={user.avatarUrl} alt={user.login} className="h-10 w-10 rounded-full border border-slate-200" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs muted">
                @{user.login} · {user.role === "admin" ? "مسؤول" : "عضو"}
              </p>
            </div>
            <Link href="/api/auth/logout" className="btn-secondary">
              تسجيل الخروج
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
