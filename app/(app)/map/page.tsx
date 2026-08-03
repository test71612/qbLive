"use client";

import { ProjectMap } from "@/components/project-map";
import { useAuth } from "@/components/auth-provider";

export default function MapPage() {
  const { currentRepo, loading } = useAuth();
  if (loading) return null;
  if (!currentRepo) return <div className="card p-6">اختر مستودعاً أولاً حتى نرسم خريطته.</div>;
  return <ProjectMap repo={currentRepo} />;
}
