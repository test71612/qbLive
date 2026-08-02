"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { formatRelativeDate } from "@/lib/utils";
import type { Task, TaskStatus } from "@/lib/types";

type TasksClientProps = {
  repo: string;
};

const columns: Array<{ key: TaskStatus; label: string }> = [
  { key: "todo", label: "للتنفيذ" },
  { key: "in_progress", label: "قيد التنفيذ" },
  { key: "done", label: "منجز" },
];

export function TasksClient({ repo }: TasksClientProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [filePaths, setFilePaths] = useState("");

  const loadTasks = useCallback(async () => {
    const response = await fetch(`/api/tasks?repo=${encodeURIComponent(repo)}`);
    const payload = await response.json();
    setTasks(payload.tasks ?? []);
  }, [repo]);

  useEffect(() => {
    if (!repo) return;
    void loadTasks();
  }, [loadTasks, repo]);

  useEffect(() => {
    if (!repo) return;
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`tasks:${repo}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        void loadTasks();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadTasks, repo]);

  const grouped = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        tasks: tasks.filter((task) => task.status === column.key),
      })),
    [tasks],
  );

  async function createTask() {
    if (!title.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repo,
        title,
        filePaths: filePaths
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    });
    setTitle("");
    setFilePaths("");
    await loadTasks();
  }

  async function moveTask(task: Task, status: TaskStatus) {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: task.id, status }),
    });
    await loadTasks();
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h1 className="text-2xl font-bold">لوحة المهام</h1>
        <p className="mt-1 text-sm muted">كل بطاقة يمكن ربطها بنفس مسارات الملفات التي يستخدمها نظام الحجز.</p>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <input className="input" placeholder="عنوان المهمة" value={title} onChange={(event) => setTitle(event.target.value)} />
          <input
            className="input code"
            placeholder="file paths مفصولة بفواصل"
            value={filePaths}
            onChange={(event) => setFilePaths(event.target.value)}
          />
          <button className="btn-primary" onClick={() => void createTask()}>
            أضف المهمة
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        {grouped.map((column) => (
          <div key={column.key} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">{column.label}</h2>
              <span className="pill pill-free">{column.tasks.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {column.tasks.length === 0 && <p className="text-sm muted">لا توجد بطاقات هنا.</p>}
              {column.tasks.map((task) => (
                <article key={task.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-semibold">{task.title}</p>
                  <p className="mt-1 text-xs muted">
                    @{task.created_by_github_username} · {formatRelativeDate(task.created_at)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {task.file_paths.length === 0 && <span className="text-xs muted">بدون ملفات مرتبطة</span>}
                    {task.file_paths.map((path) => (
                      <span key={path} className="rounded-full bg-slate-100 px-3 py-1 text-xs code">
                        {path}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {columns
                      .filter((target) => target.key !== task.status)
                      .map((target) => (
                        <button key={target.key} className="btn-secondary" onClick={() => void moveTask(task, target.key)}>
                          انقل إلى {target.label}
                        </button>
                      ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
