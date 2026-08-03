import Link from "next/link";
import { ExplorerClient } from "@/components/explorer-client";
import { getShellData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

type ExplorerPageProps = {
  searchParams: Promise<{
    path?: string | string[];
  }>;
};

export default async function ExplorerPage({ searchParams }: ExplorerPageProps) {
  const { user, currentRepo } = await getShellData();
  const params = await searchParams;
  const path = Array.isArray(params.path) ? params.path[0] : params.path;

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
    return <div className="card p-6 text-sm muted">أضف مستودعًا أولًا حتى نعرض شجرة الملفات.</div>;
  }

  return (
    <ExplorerClient
      repo={currentRepo}
      login={user.login}
      role={user.role}
      initialPath={path?.trim() ?? ""}
    />
  );
}
