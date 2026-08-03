"use client";

import { ExplorerClient } from "@/components/explorer-client";
import { useAuth } from "@/components/auth-provider";
import { useSearchParams } from "next/navigation";

export default function ExplorerPage() {
  const { user, currentRepo, loading } = useAuth();
  const searchParams = useSearchParams();
  const path = searchParams.get("path");
  if (loading || !user) return null;

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
