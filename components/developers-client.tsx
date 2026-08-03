"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRelativeDate } from "@/lib/utils";

type WorkItem = {
  repo: string;
  paths: string[];
  reason: string;
  lastActiveAt: string;
};

type Developer = {
  login: string;
  name: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  lastSeenAt: string;
  online: boolean;
  workingOn: WorkItem[];
};

type DevelopersPayload = {
  developers: Developer[];
  canDelete: boolean;
  ownerLogin: string;
  error?: string;
};

export function DevelopersClient({ currentLogin }: { currentLogin: string }) {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [ownerLogin, setOwnerLogin] = useState("");
  const [login, setLogin] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadDevelopers = useCallback(async () => {
    const response = await fetch("/api/developers", { cache: "no-store" });
    const payload = (await response.json()) as DevelopersPayload;
    if (!response.ok) {
      setMessage("تعذر تحميل قائمة المطورين الآن.");
      return;
    }
    setDevelopers(payload.developers ?? []);
    setCanDelete(Boolean(payload.canDelete));
    setOwnerLogin(payload.ownerLogin ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void loadDevelopers(), 0);
    const timer = window.setInterval(() => void loadDevelopers(), 30_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(timer);
    };
  }, [loadDevelopers]);

  async function addDeveloper(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!login.trim()) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/developers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error === "invalid_github_username" ? "اكتب اسم مستخدم GitHub صحيحاً فقط، بدون رابط." : "تعذر إضافة الحساب. تأكد أن الحساب موجود في GitHub.");
        return;
      }
      setLogin("");
      setMessage("تمت إضافة المطور؛ يمكنه الآن تسجيل الدخول.");
      await loadDevelopers();
    } finally {
      setSubmitting(false);
    }
  }

  async function removeDeveloper(developer: Developer) {
    if (!window.confirm(`حذف ${developer.login} من قائمة الدخول؟ سيفقد الوصول بعد طلبه التالي.`)) return;
    setMessage("");
    const response = await fetch("/api/developers", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login: developer.login }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error === "owner_only" ? "الحذف متاح لصاحب المشروع فقط." : "تعذر حذف المطور الآن.");
      return;
    }
    setMessage(`تم حذف @${developer.login} من قائمة الدخول.`);
    await loadDevelopers();
  }

  return (
    <div className="space-y-6">
      <section className="developers-hero">
        <p>QB TEAM · PEOPLE MAP</p>
        <h1>من يعمل الآن؟ ومن يمكنه الدخول؟</h1>
        <span>كل مطور مسجل هنا يستطيع دخول مساحة العمل. وأي مطور موجود يستطيع إضافة زميل جديد.</span>
      </section>

      <section className="card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black">إضافة مطور</h2>
            <p className="mt-1 text-sm muted">أدخل اسم حساب GitHub فقط مثل <span className="code">octocat</span>؛ لا يلزم أن يسجل دخولاً أولاً.</p>
          </div>
          <form className="developer-add-form" onSubmit={addDeveloper}>
            <input className="input" value={login} onChange={(event) => setLogin(event.target.value)} placeholder="GitHub username" autoComplete="off" />
            <button className="btn-primary" disabled={submitting}>{submitting ? "جارٍ الإضافة..." : "إضافة للمطورين"}</button>
          </form>
        </div>
        {message && <p className="developer-message" role="status">{message}</p>}
        {ownerLogin && <p className="mt-3 text-xs muted">صاحب المشروع: <span className="code">@{ownerLogin}</span> — الحذف محصور به.</p>}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black">المطورون <span className="text-orange-400">({developers.length})</span></h2>
          <span className="text-xs muted">تتحدث الحالة تلقائياً كل 30 ثانية</span>
        </div>
        {loading ? (
          <div className="card p-6 text-sm muted">جارٍ قراءة حالة الفريق...</div>
        ) : (
          <div className="developer-grid">
            {developers.map((developer) => (
              <article key={developer.login} className="developer-card">
                <div className="flex items-start gap-3">
                  {developer.avatarUrl ? (
                    <img className="developer-avatar" src={developer.avatarUrl} alt={developer.login} />
                  ) : (
                    <div className="developer-avatar developer-avatar-fallback">{developer.login.slice(0, 1).toUpperCase()}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-black text-white">{developer.name}</h3>
                      {developer.role === "admin" && <span className="developer-role">مسؤول</span>}
                      {developer.login.toLowerCase() === currentLogin.toLowerCase() && <span className="developer-you">أنت</span>}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-400">@{developer.login}</p>
                  </div>
                  <span className={developer.online ? "presence presence-online" : "presence presence-offline"}>{developer.online ? "متصل" : "غير متصل"}</span>
                </div>

                <div className="developer-status">
                  <span>{developer.online ? "نشط الآن" : `آخر ظهور ${formatRelativeDate(developer.lastSeenAt)}`}</span>
                  <span>·</span>
                  <span>{developer.workingOn.length > 0 ? "يعمل على ملفات محجوزة" : "لا توجد مهمة محجوزة الآن"}</span>
                </div>

                {developer.workingOn.length > 0 && (
                  <div className="developer-work">
                    {developer.workingOn.map((work) => (
                      <div key={`${work.repo}:${work.paths.join(",")}`}>
                        <p className="font-bold text-orange-200">{work.reason}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">{work.repo} · {work.paths.join("، ")}</p>
                      </div>
                    ))}
                  </div>
                )}

                {canDelete && developer.login.toLowerCase() !== ownerLogin.toLowerCase() && (
                  <button type="button" className="danger-button mt-4" onClick={() => void removeDeveloper(developer)}>حذف من قائمة الدخول</button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
