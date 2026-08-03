import Link from "next/link";
import { TasksClient } from "@/components/tasks-client";
import { getShellData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { user, currentRepo } = await getShellData();

  if (!user) {
    return (
      <div className="card p-6 text-sm muted">
        لم يتم العثور على جلسة نشطة. يرجى تسجيل الدخول مرة أخرى ثم إعادة تحميل الصفحة.
        <div className="mt-4">
          <Link href="/" className="btn-primary">
            الذهاب إلى الصفحة الرئيسية
          </Link>
        </div>
      </div>
    );
  }

  if (!currentRepo) {
    return <div className="card p-6 text-sm muted">أضف مستودعًا أولًا حتى نعرض لوحة المهام.</div>;
  }

  return <TasksClient repo={currentRepo} />;
}
