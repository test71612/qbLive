import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getShellData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, repos, currentRepo } = await getShellData();

  if (!user) {
    redirect("/");
  }

  return (
    <AppShell user={user} repos={repos} currentRepo={currentRepo}>
      {children}
    </AppShell>
  );
}
