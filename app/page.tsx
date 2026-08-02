import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="shell flex flex-1 items-center">
      <section className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-8 lg:p-10">
          <span className="pill pill-free">Ops Hub</span>
          <h1 className="mt-5 text-3xl font-bold leading-tight lg:text-4xl">
            لوحة داخلية تمنع تضارب التعديلات وتوضح من يعمل على أي ملف الآن.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 muted">
            سجّل عبر GitHub، اربط المستودع، ثم راقب الحجوزات الحية والملاحظات والمهام من مكان واحد. التطبيق نفسه
            لا يعدّل الكود؛ هو فقط ينظّم العمل حوله.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/api/auth/login" className="btn-primary">
              تسجيل الدخول عبر GitHub
            </Link>
            <a href="#setup" className="btn-secondary">
              ماذا أحتاج قبل النشر؟
            </a>
          </div>
        </div>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-lg font-bold">المزايا الأساسية</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
              <li>حجز ملف أو عدة ملفات مع سبب واضح يظهر للجميع مباشرة.</li>
              <li>مستكشف ملفات يقرأ من GitHub مع معاينة وملاحظات بسيطة لكل ملف.</li>
              <li>لوحة مهام مرتبطة بنفس مسارات الملفات حتى تعرف لماذا الملف محجوز.</li>
            </ul>
          </section>

          <section id="setup" className="card p-6">
            <h2 className="text-lg font-bold">قبل تشغيله أو نشره</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
              <li>أنشئ مشروع Supabase مجاني وشغّل ملف `schema.sql`.</li>
              <li>أنشئ GitHub OAuth App وحدد رابط `callback` الصحيح.</li>
              <li>أضف متغيرات البيئة الموجودة في `.env.example` محليًا وعلى Vercel.</li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
