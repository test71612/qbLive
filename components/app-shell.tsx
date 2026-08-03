"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

const links = [
  { href: "/dashboard", label: "اللوحة" },
  { href: "/explorer", label: "المستكشف" },
  { href: "/map", label: "خريطة المشروع" },
  { href: "/tasks", label: "المهام" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, repos, currentRepo, loading, updateRepo: persistRepo } = useAuth();
  const [selectedRepo, setSelectedRepo] = useState("");

  async function updateRepo(repo: string) {
    setSelectedRepo(repo);
    await persistRepo(repo);
  }

  function logout() {
    window.localStorage.removeItem("ops_hub_session");
    router.replace("/");
  }

  if (loading || !user) return <main className="shell flex flex-1 items-center justify-center"><p className="card p-6 text-sm muted">جارٍ التحقق من الجلسة...</p></main>;

  return (
    <div className="shell">
      <header className="card mb-6 flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">
            QB
          </div>
          <div>
            <p className="text-lg font-bold">QB Team</p>
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
                pathname === link.href ? "bg-orange-500 text-black" : "bg-white/5 text-slate-300 hover:bg-white/10",
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
              value={selectedRepo || currentRepo}
              onChange={(event) => void updateRepo(event.target.value)}
              disabled={repos.length === 0}
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
            <button type="button" className="btn-secondary" onClick={logout}>
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
