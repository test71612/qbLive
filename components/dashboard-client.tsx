"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { formatRelativeDate } from "@/lib/utils";
import type { AuditEntry, FileLock, GitHubCommit, Role } from "@/lib/types";

type DashboardClientProps = {
  repo: string;
  role: Role;
  login: string;
};

const actionLabels: Record<string, string> = {
  claim: "حجز ملفات",
  release: "أنهى الحجز",
  force_release: "فك حجز إداري",
  release_idle: "انتهى الحجز تلقائيًا",
  push: "دفع تعديلات",
  task_move: "حرّك مهمة",
  task_create: "أنشأ مهمة",
  note_edit: "حدّث ملاحظة",
  repo_add: "أضاف مستودعًا",
};

export function DashboardClient({ repo, role, login }: DashboardClientProps) {
  const [locks, setLocks] = useState<FileLock[]>([]);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!repo) return;
    setLoading(true);
    const [locksRes, activityRes, commitsRes] = await Promise.all([
      fetch(`/api/locks?repo=${encodeURIComponent(repo)}`),
      fetch(`/api/activity?repo=${encodeURIComponent(repo)}&limit=20`),
      fetch(`/api/github/commits?repo=${encodeURIComponent(repo)}&limit=8`),
    ]);

    const locksData = await locksRes.json();
    const activityData = await activityRes.json();
    const commitsData = await commitsRes.json();

    setLocks(locksData.locks ?? []);
    setActivity(activityData.entries ?? []);
    setCommits(commitsData.commits ?? []);
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!repo) return;
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`locks:${repo}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_locks" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, repo]);

  const myLocks = useMemo(() => locks.filter((lock) => lock.locked_by_github_username === login), [locks, login]);

  async function release(id: string) {
    await fetch("/api/locks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: "release" }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <section className="top-grid">
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">الحجوزات الحالية</h1>
              <p className="mt-1 text-sm muted">هذه أهم شاشة في الأداة: من يعمل على ماذا الآن ولماذا.</p>
            </div>
            <span className="pill pill-free ms-auto">{locks.length} حجز نشط</span>
          </div>

          {!repo && <p className="mt-4 text-sm text-amber-700">أضف مستودعًا أولًا من API أو جدول `repos`.</p>}
          {loading && <p className="mt-4 text-sm muted">جارٍ تحميل البيانات...</p>}

          <div className="mt-5 space-y-3">
            {!loading && locks.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <p className="font-semibold">لا توجد حجوزات نشطة الآن</p>
                <p className="mt-1 text-sm muted">هذا وقت ممتاز للبدء من صفحة المستكشف.</p>
                <Link href="/explorer" className="btn-primary mt-4">
                  افتح المستكشف
                </Link>
              </div>
            )}

            {locks.map((lock) => (
              <article key={lock.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="pill pill-locked">محجوز</span>
                      <span className="text-sm font-semibold">@{lock.locked_by_github_username}</span>
                    </div>
                    <p className="text-sm">{lock.reason}</p>
                    <p className="text-xs muted">{formatRelativeDate(lock.created_at)}</p>
                  </div>

                  {(lock.locked_by_github_username === login || role === "admin") && (
                    <button className="btn-secondary ms-auto" onClick={() => void release(lock.id)}>
                      {lock.locked_by_github_username === login ? "أنهِ الحجز" : "فك الحجز"}
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {lock.file_paths.map((path) => (
                    <Link
                      key={path}
                      href={`/explorer?path=${encodeURIComponent(path)}`}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200"
                    >
                      {path}
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-lg font-bold">ملخصي السريع</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-sm muted">حجوزاتي</p>
                <p className="mt-1 text-2xl font-bold">{myLocks.length}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-sm muted">آخر تحديث من GitHub</p>
                <p className="mt-1 text-sm font-semibold">{commits[0]?.message ?? "لا يوجد بعد"}</p>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">آخر الكومِتات</h2>
            <div className="mt-4 space-y-3">
              {commits.length === 0 && <p className="text-sm muted">لا توجد بيانات بعد.</p>}
              {commits.map((commit) => (
                <a key={commit.sha} href={commit.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                  <p className="text-sm font-semibold">{commit.message}</p>
                  <p className="mt-1 text-xs muted">
                    {commit.author} · {formatRelativeDate(commit.date)} · <span className="code">{commit.sha}</span>
                  </p>
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold">سجل النشاط</h2>
        <div className="mt-4 space-y-3">
          {activity.length === 0 && <p className="text-sm muted">لا توجد أحداث بعد.</p>}
          {activity.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-start gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{entry.actor ?? "النظام"}</span> {actionLabels[entry.action] ?? entry.action}
                </p>
                {entry.target && <p className="mt-1 break-all text-xs muted">{entry.target}</p>}
              </div>
              <span className="text-xs muted">{formatRelativeDate(entry.created_at)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
