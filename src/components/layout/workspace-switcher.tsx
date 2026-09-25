"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { api, ClientApiError } from "@/lib/api-client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ROLE_LABELS_FA } from "@/lib/permissions";

export function WorkspaceSwitcher() {
  const { workspace, workspaces, role } = useWorkspace();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function switchTo(id: string) {
    if (id === workspace.id) return;
    setLoading(true);
    try {
      await api.post("/api/workspaces/switch", { workspaceId: id });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center gap-2 rounded-xl border border-(--color-border) bg-white px-3 py-2.5 text-right transition hover:bg-slate-50 disabled:opacity-60"
          disabled={loading}
        >
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: workspace.logoColor ?? "#4338ca" }}
          >
            {workspace.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-(--color-text)">{workspace.name}</p>
            <p className="text-[11px] text-(--color-muted)">{ROLE_LABELS_FA[role]}</p>
          </div>
          <ChevronsUpDown className="size-3.5 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaceهای من</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => switchTo(w.id)}>
            <div className="flex size-6 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: w.logoColor ?? "#4338ca" }}>
              {w.name.slice(0, 1)}
            </div>
            <span className="flex-1 truncate">{w.name}</span>
            {w.id === workspace.id && <Check className="size-4 text-(--color-primary)" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
          <Plus className="size-4" />
          ساخت Workspace جدید
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
