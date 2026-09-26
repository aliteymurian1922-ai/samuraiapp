"use client";

import { useEffect, useState, type ElementType } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useUIStore } from "@/stores/ui-store";
import { MAIN_NAV } from "@/lib/nav";
import { FolderKanban, ListChecks, Video, Search, ArrowLeft } from "lucide-react";

type SearchResults = {
  projects: { id: string; name: string }[];
  tasks: { id: string; title: string; projectId: string }[];
  members: { id: string; name: string; email: string }[];
  meetings: { id: string; title: string }[];
};

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setCreateTaskOpen, setCreateProjectOpen, setCreateMeetingOpen } = useUIStore();
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === "Escape") setCommandPaletteOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const { data } = useQuery({
    queryKey: ["global-search", query],
    queryFn: () => api.get<{ results: SearchResults }>(`/api/search?q=${encodeURIComponent(query)}`),
    enabled: commandPaletteOpen && query.trim().length > 1,
  });

  function go(href: string) {
    setCommandPaletteOpen(false);
    setQuery("");
    router.push(href);
  }

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-4 pt-24 backdrop-blur-[2px]" onClick={() => setCommandPaletteOpen(false)}>
      <Command
        shouldFilter={false}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-(--color-border) bg-white shadow-[0_30px_60px_-15px_rgba(15,23,42,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
          <Search className="size-4 text-slate-400" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="جستجو یا اجرای دستور... (مثلاً «وظیفه جدید»)"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <Command.List className="max-h-96 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-xs text-(--color-muted)">نتیجه‌ای یافت نشد.</Command.Empty>

          {query.trim().length <= 1 && (
            <Command.Group heading="دستورات سریع" className="px-2 py-1 text-[11px] font-semibold text-(--color-muted)">
              <PaletteItem onSelect={() => { setCommandPaletteOpen(false); setCreateTaskOpen(true); }} icon={ListChecks} label="ایجاد وظیفه جدید" shortcut="C" />
              <PaletteItem onSelect={() => { setCommandPaletteOpen(false); setCreateProjectOpen(true); }} icon={FolderKanban} label="ایجاد پروژه جدید" shortcut="P" />
              <PaletteItem onSelect={() => { setCommandPaletteOpen(false); setCreateMeetingOpen(true); }} icon={Video} label="ایجاد جلسه جدید" />
              {MAIN_NAV.map((item) => (
                <PaletteItem key={item.href} onSelect={() => go(item.href)} icon={item.icon} label={`رفتن به ${item.label}`} />
              ))}
            </Command.Group>
          )}

          {data?.results && query.trim().length > 1 && (
            <>
              {data.results.projects.length > 0 && (
                <Command.Group heading="پروژه‌ها" className="px-2 py-1 text-[11px] font-semibold text-(--color-muted)">
                  {data.results.projects.map((p) => (
                    <PaletteItem key={p.id} onSelect={() => go(`/app/projects/${p.id}`)} icon={FolderKanban} label={p.name} />
                  ))}
                </Command.Group>
              )}
              {data.results.tasks.length > 0 && (
                <Command.Group heading="وظایف" className="px-2 py-1 text-[11px] font-semibold text-(--color-muted)">
                  {data.results.tasks.map((t) => (
                    <PaletteItem key={t.id} onSelect={() => go(`/app/tasks?taskId=${t.id}`)} icon={ListChecks} label={t.title} />
                  ))}
                </Command.Group>
              )}
            </>
          )}
        </Command.List>
      </Command>
    </div>
  );
}

function PaletteItem({ onSelect, icon: Icon, label, shortcut }: { onSelect: () => void; icon: ElementType<{ className?: string }>; label: string; shortcut?: string }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-(--color-text) data-[selected=true]:bg-slate-100"
    >
      <Icon className="size-4 text-slate-400" />
      <span className="flex-1">{label}</span>
      {shortcut && <kbd className="kbd">{shortcut}</kbd>}
      <ArrowLeft className="size-3.5 text-slate-300" />
    </Command.Item>
  );
}
