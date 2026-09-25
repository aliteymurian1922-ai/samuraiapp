"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { MembershipRole } from "@/lib/permissions";

export type WorkspaceContextValue = {
  user: { id: string; name: string; email: string; avatarColor: string | null };
  workspace: { id: string; name: string; slug: string; teamType: string | null; logoColor: string | null };
  role: MembershipRole;
  workspaces: { id: string; name: string; slug: string; role: MembershipRole; logoColor: string | null }[];
};

const WorkspaceCtx = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceContextValue; children: ReactNode }) {
  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
