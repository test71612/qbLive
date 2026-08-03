"use client";

import { TasksClient } from "@/components/tasks-client";
import { useAuth } from "@/components/auth-provider";

export default function TasksPage() {
  const { user, currentRepo, loading } = useAuth();
  if (loading || !user) return null;

  if (!currentRepo) {
    return <div className="card p-6 text-sm muted">أضف مستودعًا أولًا حتى نعرض لوحة المهام.</div>;
  }

  return <TasksClient repo={currentRepo} />;
}
