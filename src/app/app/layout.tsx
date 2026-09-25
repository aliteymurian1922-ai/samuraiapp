import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserWorkspaces, requireWorkspaceContext } from "@/lib/auth/context";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspaces = await getUserWorkspaces(user.id);
  if (workspaces.length === 0) redirect("/onboarding");

  const { workspace, role } = await requireWorkspaceContext();

  return (
    <AppShell
      value={{
        user,
        workspace,
        role,
        workspaces: workspaces.map((w) => ({ id: w.id, name: w.name, slug: w.slug, role: w.role, logoColor: w.logoColor })),
      }}
    >
      {children}
    </AppShell>
  );
}
