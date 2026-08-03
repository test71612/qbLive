"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { ProjectGuide } from "@/components/project-guide";
import { buildTree, cn, formatRelativeDate, isTextPath } from "@/lib/utils";
import type { FileLock, GitHubCommit, GitHubFile, GitHubTreeNode, RelatedFileResult, Role } from "@/lib/types";

type ExplorerClientProps = {
  repo: string;
  login: string;
  role: Role;
  initialPath: string;
};

export function ExplorerClient({ repo, login, role, initialPath }: ExplorerClientProps) {
  const [tree, setTree] = useState<GitHubTreeNode[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [file, setFile] = useState<GitHubFile | null>(null);
  const [note, setNote] = useState("");
  const [noteSavedAt, setNoteSavedAt] = useState("");
  const [reason, setReason] = useState("");
  const [related, setRelated] = useState<RelatedFileResult>({ imports: [], importedBy: [], manual: [] });
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [locks, setLocks] = useState<FileLock[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [treeError, setTreeError] = useState("");
  const [fileError, setFileError] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(["app", "components", "lib"]));

  const loadLocks = useCallback(async () => {
    const response = await fetch(`/api/locks?repo=${encodeURIComponent(repo)}`);
    const payload = await response.json();
    setLocks(payload.locks ?? []);
  }, [repo]);

  const loadTree = useCallback(async () => {
    if (!repo) return;
    setLoadingTree(true);
    setTreeError("");
    const response = await fetch(`/api/github/tree?repo=${encodeURIComponent(repo)}`);
    const payload = await response.json();
    if (!response.ok) {
      setTree([]);
      setTreeError(payload.error ?? "تعذر تحميل شجرة الملفات.");
      setLoadingTree(false);
      return;
    }
    setTree(payload.tree ?? []);
    setLoadingTree(false);
  }, [repo]);

  const loadFile = useCallback(
    async (path: string) => {
      if (!repo || !path) return;
      setLoadingFile(true);
      setFileError("");

      const [fileRes, noteRes, relatedRes, commitsRes] = await Promise.all([
        fetch(`/api/github/file?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`),
        fetch(`/api/notes?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`),
        fetch(`/api/related?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`),
        fetch(`/api/github/commits?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}&limit=6`),
      ]);

      const filePayload = await fileRes.json();
      const notePayload = await noteRes.json();
      const relatedPayload = await relatedRes.json();
      const commitsPayload = await commitsRes.json();

      if (!fileRes.ok) {
        setFile(null);
        setFileError(filePayload.error ?? "تعذر عرض هذا الملف.");
        setNote(notePayload.note?.note ?? "");
        setNoteSavedAt(notePayload.note?.updated_at ?? "");
        setRelated({
          imports: relatedPayload.imports ?? [],
          importedBy: relatedPayload.importedBy ?? [],
          manual: relatedPayload.manual ?? [],
        });
        setCommits(commitsPayload.commits ?? []);
        setLoadingFile(false);
        return;
      }

      setFile(filePayload.path ? filePayload : null);
      setNote(notePayload.note?.note ?? "");
      setNoteSavedAt(notePayload.note?.updated_at ?? "");
      setRelated({
        imports: relatedPayload.imports ?? [],
        importedBy: relatedPayload.importedBy ?? [],
        manual: relatedPayload.manual ?? [],
      });
      setCommits(commitsPayload.commits ?? []);
      setLoadingFile(false);
    },
    [repo],
  );

  useEffect(() => {
    void Promise.all([loadTree(), loadLocks()]);
  }, [loadLocks, loadTree]);

  useEffect(() => {
    if (selectedPath) {
      void loadFile(selectedPath);
    }
  }, [loadFile, selectedPath]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const lockChannel = supabase
      .channel(`explorer-locks:${repo}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_locks" }, () => {
        void loadLocks();
      })
      .subscribe();
    const noteChannel = supabase
      .channel(`explorer-notes:${repo}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_notes" }, () => {
        if (selectedPath) void loadFile(selectedPath);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(lockChannel);
      void supabase.removeChannel(noteChannel);
    };
  }, [loadFile, loadLocks, repo, selectedPath]);

  const filePaths = useMemo(
    () =>
      tree
        .filter((node) => node.type === "blob")
        .map((node) => node.path)
        .filter((path) => path.toLowerCase().includes(search.toLowerCase())),
    [search, tree],
  );

  const treeData = useMemo(() => buildTree(filePaths), [filePaths]);
  const currentLock = useMemo(
    () => locks.find((lock) => lock.file_paths.includes(selectedPath) && !lock.released_at) ?? null,
    [locks, selectedPath],
  );

  function openPath(path: string) {
    setSelectedPath(path);
    window.history.replaceState(null, "", `/explorer?path=${encodeURIComponent(path)}`);
  }

  function toggleFolder(path: string) {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function fileIcon(path: string) {
    if (/\.(tsx?|jsx?)$/i.test(path)) return "⌘";
    if (/\.(css|scss)$/i.test(path)) return "◈";
    if (/\.(json|ya?ml)$/i.test(path)) return "{}";
    if (/\.(md|txt)$/i.test(path)) return "≡";
    return "·";
  }

  async function saveNote() {
    if (!selectedPath || !note.trim()) return;
    const response = await fetch("/api/notes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo, path: selectedPath, note }),
    });
    const payload = await response.json();
    setNoteSavedAt(payload.note?.updated_at ?? new Date().toISOString());
  }

  async function claimFile(force = false) {
    if (!selectedPath || !reason.trim()) return;
    const response = await fetch("/api/locks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo, filePaths: [selectedPath], reason, force }),
    });

    if (response.status === 409) {
      const payload = await response.json();
      const names = (payload.conflicts ?? []).map((item: { lock: FileLock }) => item.lock.locked_by_github_username).join("، ");
      const confirmed = window.confirm(`هذا الملف محجوز حاليًا بواسطة: ${names}. هل تريد الاستمرار رغم التعارض؟`);
      if (confirmed) {
        await claimFile(true);
      }
      return;
    }

    setReason("");
    await loadLocks();
  }

  async function releaseCurrentLock() {
    if (!currentLock) return;
    await fetch("/api/locks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: currentLock.id, action: "release" }),
    });
    await loadLocks();
  }

  function renderTree(node: Map<string, unknown>, prefix = "", level = 0): React.ReactNode {
    return [...node.entries()].sort(([, left], [, right]) => Number(right instanceof Map) - Number(left instanceof Map)).map(([name, value]) => {
      const path = prefix ? `${prefix}/${name}` : name;
      const isDir = value instanceof Map;

      if (isDir) {
        return (
          <div key={path}>
            <button type="button" className="tree-folder" style={{ paddingInlineStart: `${level * 12 + 8}px` }} onClick={() => toggleFolder(path)}>
              <span className={cn("tree-caret", expandedFolders.has(path) && "tree-caret-open")}>›</span><span className="tree-folder-icon">▣</span><span>{name}</span>
            </button>
            {expandedFolders.has(path) && <div className="tree-children">{renderTree(value as Map<string, unknown>, path, level + 1)}</div>}
          </div>
        );
      }

      return (
        <button key={path} type="button" className={cn("tree-button", selectedPath === path && "tree-button-active")} style={{ paddingInlineStart: `${level * 12 + 12}px` }} onClick={() => openPath(path)}>
          <span className="tree-file-icon">{fileIcon(path)}</span>
          <span className="text-slate-400">{selectedPath === path ? "●" : "○"}</span>
          <span className={selectedPath === path ? "font-semibold text-blue-700" : ""}>{name}</span>
        </button>
      );
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <aside className="explorer-sidebar card p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold">مستكشف الملفات</h1>
          <span className="text-xs muted">{filePaths.length} ملف</span>
        </div>
        <input
          className="input mt-4"
          placeholder="ابحث عن ملف..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="tree-summary mt-3"><span>شجرة المشروع</span><span>{filePaths.length} ملف</span></div>
        <div className="mt-2 max-h-[70vh] overflow-auto pe-1">
          {loadingTree ? <p className="text-sm muted">جارٍ تحميل شجرة الملفات...</p> : renderTree(treeData)}
          {!loadingTree && treeError && <p className="text-sm text-rose-700">{treeError}</p>}
          {!loadingTree && !treeError && filePaths.length === 0 && <p className="text-sm muted">لم نجد ملفات لعرضها في هذا المستودع.</p>}
        </div>
      </aside>

      <section className="space-y-6">
        <ProjectGuide repo={repo} path={selectedPath} />
        <div className="card p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs muted">الملف الحالي</p>
              <h2 className="mt-1 break-all text-xl font-bold">{selectedPath || "اختر ملفًا من القائمة"}</h2>
            </div>
            {currentLock ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <p className="font-semibold">@{currentLock.locked_by_github_username}</p>
                <p className="mt-1">{currentLock.reason}</p>
                <p className="mt-1 text-xs">{formatRelativeDate(currentLock.created_at)}</p>
                {(currentLock.locked_by_github_username === login || role === "admin") && (
                  <button className="btn-secondary mt-3" onClick={() => void releaseCurrentLock()}>
                    {currentLock.locked_by_github_username === login ? "أنهِ حجزي" : "فك الحجز"}
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                هذا الملف غير محجوز الآن
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              className="input"
              placeholder="سبب الحجز: مثلًا أصلح مسار تسجيل الدخول"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <button className="btn-primary" onClick={() => void claimFile()}>
              احجز الملف
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-bold">معاينة الملف</h3>
            </div>
            <div className="max-h-[70vh] overflow-auto bg-slate-950 p-5 text-sm text-slate-100">
              {!selectedPath && <p>اختر ملفًا لعرض محتواه.</p>}
              {loadingFile && <p>جارٍ تحميل الملف...</p>}
              {!loadingFile && selectedPath && fileError && <p>{fileError}</p>}
              {!loadingFile && selectedPath && !file && !fileError && <p>تعذر عرض هذا الملف. ربما هو ملف ثنائي أو المسار غير صحيح.</p>}
              {!loadingFile && file && (
                <pre className="code whitespace-pre-wrap break-words">
                  {isTextPath(file.path) ? file.content : "هذا النوع من الملفات لا يُعرض كنص داخل المستكشف."}
                </pre>
              )}
            </div>
          </section>

          <div className="space-y-6">
            <section className="card p-5">
              <h3 className="font-bold">ملاحظة بلغة بسيطة</h3>
              <p className="mt-1 text-sm muted">مثال: هذا الملف يتحكم في شاشة البطولة.</p>
              <textarea className="textarea mt-4" value={note} onChange={(event) => setNote(event.target.value)} />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs muted">{noteSavedAt ? `آخر تحديث ${formatRelativeDate(noteSavedAt)}` : "لا توجد ملاحظة محفوظة بعد"}</span>
                <button className="btn-secondary" onClick={() => void saveNote()}>
                  حفظ الملاحظة
                </button>
              </div>
            </section>

            <section className="card p-5">
              <h3 className="font-bold">ملفات مرتبطة</h3>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="font-semibold">يستدعي</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {related.imports.length === 0 && <span className="muted">لا توجد بيانات</span>}
                    {related.imports.map((path) => (
                      <button key={path} className="related-file" onClick={() => openPath(path)}>
                        {path}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-semibold">يُستدعى من</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {related.importedBy.length === 0 && <span className="muted">لا توجد بيانات</span>}
                    {related.importedBy.map((path) => (
                      <button key={path} className="related-file" onClick={() => openPath(path)}>
                        {path}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-semibold">ربط يدوي</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {related.manual.length === 0 && <span className="muted">لا توجد بيانات</span>}
                    {related.manual.map((path) => (
                      <button key={path} className="related-file" onClick={() => openPath(path)}>
                        {path}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="card p-5">
              <h3 className="font-bold">آخر التعديلات على الملف</h3>
              <div className="mt-4 space-y-3">
                {commits.length === 0 && <p className="text-sm muted">لا توجد بيانات بعد.</p>}
                {commits.map((commit) => (
                  <a key={commit.sha} href={commit.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                    <p className="text-sm font-semibold">{commit.message}</p>
                    <p className="mt-1 text-xs muted">
                      {commit.author} · {formatRelativeDate(commit.date)} · <span className="code">{commit.sha}</span>
                    </p>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
