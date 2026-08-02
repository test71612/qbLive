"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./AppContext";
import ClaimTag from "./ClaimTag";
import { useLocks } from "@/hooks/useLocks";
import { elapsed } from "@/lib/utils";
import type { AuditEntry, FileLock } from "@/lib/types";

type Commit = { sha: string; message: string; author: string; date: string; url: string };

const actionLabel: Record<string, { ar: string; en: string }> = {
  claim: { ar: "حجز", en: "claimed" },
  release: { ar: "أنهى الحجز", en: "released" },
  force_release: { ar: "أنهى حجز غيره", en: "force-released" },
  release_idle: { ar: "حجز منتهٍ تلقائيًا", en: "auto-released" },
  push: { ar: "دفع تعديلات", en: "pushed" },
  task_move: { ar: "حرّك مهمة", en: "moved a task" },
  note_edit: { ar: "حدّث ملاحظة", en: "edited a note" },
};

export default function Dashboard() {
  const { t, locale, repo } = useApp();
  const router = useRouter();
  const { locks, loading, reload } = useLocks(repo || null);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);

  useEffect(() => {
    if (!repo) return;
    fetch(`/api/activity?repo=${encodeURIComponent(repo)}&limit=20`)
      .then((r) => r.json())
      .then((d) => setActivity(d.entries ?? []))
      .catch(() => setActivity([]));
    fetch(`/api/github/commits?repo=${encodeURIComponent(repo)}&limit=8`)
      .then((r) => r.json())
      .then((d) => setCommits(d.commits ?? []))
      .catch(() => setCommits([]));
  }, [repo, locks.length]);

  async function release(lock: FileLock) {
    await fetch("/api/locks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: lock.id, action: "release" }),
    });
    void reload();
  }

  if (!repo) {
    return (
      <div className="card p-6 text-sm text-muted">
        لا يوجد مستودع متصل بعد. يضيفه أي مسؤول عبر <span className="path">POST /api/repos</span> أو من جدول{" "}
        <span className="path">repos</span> في Supabase.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold">{t("claimed")}</h1>
          <span className="flex items-center gap-1.5 text-xs text-free">
            <span className="h-2 w-2 rounded-full bg-free animate-blip" />
            {t("live")}
          </span>
          <span className="ms-auto text-xs text-muted path">{repo}</span>
        </div>

        {loading && <p className="mt-6 text-sm text-muted">{t("loading")}</p>}

        {!loading && locks.length === 0 && (
          <div className="card mt-4 p-8 text-center">
            <p className="text-base font-medium">{t("noLocks")}</p>
            <p className="mt-1 text-sm text-muted">{t("noLocksHint")}</p>
            <button className="btn-primary mt-4" onClick={() => router.push("/explorer")}>
              {t("navExplorer")}
            </button>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {locks.map((lock) => (
            <ClaimTag
              key={lock.id}
              lock={lock}
              onRelease={release}
              onOpenFile={(p) => router.push(`/explorer?path=${encodeURIComponent(p)}`)}
            />
          ))}
        </div>
      </section>

      <aside className="space-y-6">
        <section className="card p-4">
          <h2 className="eyebrow">{t("activity")}</h2>
          <ul className="mt-3 space-y-3">
            {activity.length === 0 && <li className="text-sm text-muted">{t("empty")}</li>}
            {activity.map((e) => (
              <li key={e.id} className="text-sm leading-5">
                <span className="font-medium">{e.actor ?? "—"}</span>{" "}
                <span className="text-muted">{actionLabel[e.action]?.[locale] ?? e.action}</span>
                {e.target && <span className="path block truncate text-muted">{e.target}</span>}
                <span className="text-[11px] text-muted">{elapsed(e.created_at, locale)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="eyebrow">{t("commits")}</h2>
          <ul className="mt-3 space-y-3">
            {commits.length === 0 && <li className="text-sm text-muted">{t("empty")}</li>}
            {commits.map((c) => (
              <li key={c.sha} className="text-sm leading-5">
                <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-brand">
                  {c.message}
                </a>
                <span className="block text-[11px] text-muted">
                  {c.author} · <span className="path inline">{c.sha}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
