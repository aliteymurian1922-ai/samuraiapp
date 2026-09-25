"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { SessionUser } from "@/lib/auth/session";
import type { WorkspaceSummary } from "@/lib/auth/context";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => api.get<{ user: SessionUser | null; workspaces: WorkspaceSummary[] }>("/api/auth/me"),
  });
}
