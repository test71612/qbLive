"use client";

import { DashboardClient } from "@/components/dashboard-client";
import { useAuth } from "@/components/auth-provider";

export default function DashboardPage() {
  const { user, currentRepo, loading } = useAuth();
  if (loading || !user) return null;

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
