import { AuthProvider } from "@/components/auth-provider";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider><AppShell>{children}</AppShell></AuthProvider>
  );
}
