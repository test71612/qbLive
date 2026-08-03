"use client";

import { DevelopersClient } from "@/components/developers-client";
import { useAuth } from "@/components/auth-provider";

export default function DevelopersPage() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <DevelopersClient currentLogin={user.login} />;
}
