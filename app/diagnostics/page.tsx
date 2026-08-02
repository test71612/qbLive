import { headers } from "next/headers";
import Link from "next/link";
import { env, getAppBaseUrl } from "@/lib/env";
import { getSession, sessionCookieName } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const requestUrl = `${proto}://${host}`;
  const baseUrl = getAppBaseUrl(requestUrl);
  const session = await getSession();

  const oauthRedirectUri = `${baseUrl}/api/auth/callback`;
  const checks = [
    {
      label: "APP_URL / Origin",
      ok: Boolean(baseUrl),
      value: baseUrl,
    },
    {
      label: "SESSION_SECRET",
      ok: Boolean(env.sessionSecret),
      value: env.sessionSecret ? "موجود" : "غير موجود",
    },
    {
      label: "GITHUB_CLIENT_ID",
      ok: Boolean(env.githubClientId),
      value: env.githubClientId ? "موجود" : "غير موجود",
    },
    {
      label: "GITHUB_CLIENT_SECRET",
      ok: Boolean(env.githubClientSecret),
      value: env.githubClientSecret ? "موجود" : "غير موجود",
    },
    {
      label: "OAuth redirect URI",
      ok: Boolean(oauthRedirectUri),
      value: oauthRedirectUri,
    },
    {
      label: "Webhook secret",
      ok: Boolean(env.githubWebhookSecret),
      value: env.githubWebhookSecret ? `موجود (${env.githubWebhookSecret.length} حرف)` : "غير موجود",
    },
    {
      label: "Graph ingest secret",
      ok: Boolean(env.graphIngestSecret),
      value: env.graphIngestSecret ? `موجود (${env.graphIngestSecret.length} حرف)` : "غير موجود",
    },
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 text-slate-800">
      <section className="card p-6">
        <h1 className="text-2xl font-bold">صفحة التشخيص</h1>
        <p className="mt-2 text-sm text-slate-600">
          هذه الصفحة تتحقق من إعدادات OAuth، الجلسة، والـ webhook بشكل مباشر قبل أن تبدأ في اختبار التطبيق من المتصفح.
        </p>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold">التحقق السريع</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {checks.map((check) => (
            <div key={check.label} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{check.label}</p>
                <span className={check.ok ? "text-emerald-700" : "text-rose-700"}>{check.ok ? "مقبول" : "مفقود"}</span>
              </div>
              <p className="mt-2 break-all text-sm text-slate-600">{check.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold">حالة الجلسة</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold">اسم الكوكي</p>
            <p className="mt-2 text-sm text-slate-600">{sessionCookieName}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold">هل توجد جلسة حالية؟</p>
            <p className="mt-2 text-sm text-slate-600">{session.user ? "نعم" : "لا"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold">المستخدم داخل الجلسة</p>
            <p className="mt-2 text-sm text-slate-600">{session.user?.login ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold">المستودع داخل الجلسة</p>
            <p className="mt-2 text-sm text-slate-600">{session.repo ?? "—"}</p>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold">روابط الاختبار</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/api/auth/login" className="btn-primary">
            فتح OAuth Login
          </Link>
          <Link href="/api/github/webhook" className="btn-secondary">
            اختبار Webhook endpoint
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            الانتقال إلى Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
