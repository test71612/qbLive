import { DashboardClient } from "@/components/dashboard-client";
import { getShellData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, currentRepo } = await getShellData();

  if (!user) {
    return null;
  }

  if (!currentRepo) {
    return (
      <div className="card p-6 text-sm muted">
        لا يوجد مستودع متصل بعد. أضفه من جدول <span className="code">repos</span> في Supabase أو عبر المسار{" "}
        <span className="code">POST /api/repos</span>.
      </div>
    );
  }

  return <DashboardClient repo={currentRepo} role={user.role} login={user.login} />;
}
