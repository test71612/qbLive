import { TasksClient } from "@/components/tasks-client";
import { getShellData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { currentRepo } = await getShellData();

  if (!currentRepo) {
    return <div className="card p-6 text-sm muted">أضف مستودعًا أولًا حتى نعرض لوحة المهام.</div>;
  }

  return <TasksClient repo={currentRepo} />;
}
