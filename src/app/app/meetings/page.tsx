"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { useUIStore } from "@/stores/ui-store";
import { useMeetings } from "@/hooks/use-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatJalaliDate } from "@/lib/date";
import { Plus, Video, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type MeetingDetail = {
  id: string; title: string; agenda: string | null; notes: string | null; startTime: string; endTime: string;
  location: string | null; projectId: string | null;
  participants: { id: string; name: string; avatarColor: string | null; status: string }[];
  actionItems: { id: string; title: string; isDone: boolean; assigneeId: string | null; dueDate: string | null }[];
};

export default function MeetingsPage() {
  const { setCreateMeetingOpen } = useUIStore();
  const { data, isLoading } = useMeetings();
  const meetings = data?.meetings ?? [];
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-bold">جلسات</h1>
          <p className="text-xs text-(--color-muted)">برنامه‌ریزی، دستور جلسه و موارد اقدام</p>
        </div>
        <Button onClick={() => setCreateMeetingOpen(true)}><Plus className="size-4" /> جلسه جدید</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : meetings.length === 0 ? (
        <EmptyState icon={<Video className="size-6" />} title="جلسه‌ای ثبت نشده" description="اولین جلسه تیم خود را برنامه‌ریزی کنید." action={<Button size="sm" onClick={() => setCreateMeetingOpen(true)}>ایجاد جلسه</Button>} />
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <button onClick={() => setExpanded(expanded === m.id ? null : m.id)} className="flex w-full items-center gap-3 p-4 text-right">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Video className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.title}</p>
                  <p className="text-xs text-(--color-muted)">{formatJalaliDate(m.startTime, true)}</p>
                </div>
                {new Date(m.startTime) > new Date() && <Badge variant="primary">پیش‌رو</Badge>}
                <ChevronDown className={cn("size-4 text-slate-400 transition-transform", expanded === m.id && "rotate-180")} />
              </button>
              {expanded === m.id && <MeetingDetailPanel meetingId={m.id} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingDetailPanel({ meetingId }: { meetingId: string }) {
  const queryClient = useQueryClient();
  const [newAction, setNewAction] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: () => api.get<{ meeting: MeetingDetail }>(`/api/meetings/${meetingId}`),
  });

  async function saveNotes(notes: string) {
    await api.patch(`/api/meetings/${meetingId}`, { notes });
    queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
  }

  async function addActionItem() {
    if (!newAction.trim()) return;
    try {
      await api.post(`/api/meetings/${meetingId}/action-items`, { title: newAction.trim() });
      setNewAction("");
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  async function toggleAction(id: string, isDone: boolean) {
    await api.patch(`/api/meetings/${meetingId}/action-items/${id}`, { isDone });
    queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
  }

  if (isLoading || !data) return <div className="border-t border-(--color-border) p-4"><Skeleton className="h-24" /></div>;

  const meeting = data.meeting;

  return (
    <div className="space-y-4 border-t border-(--color-border) p-4">
      {meeting.agenda && (
        <div>
          <p className="mb-1 text-xs font-semibold text-(--color-muted)">دستور جلسه</p>
          <p className="whitespace-pre-wrap text-[13px] text-(--color-text)">{meeting.agenda}</p>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold text-(--color-muted)">یادداشت‌های جلسه</p>
        <Textarea rows={3} defaultValue={meeting.notes ?? ""} onBlur={(e) => saveNotes(e.target.value)} placeholder="یادداشت‌های جلسه را اینجا بنویسید..." />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-(--color-muted)">موارد اقدام ({meeting.actionItems.length})</p>
        <div className="space-y-1.5">
          {meeting.actionItems.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg border border-(--color-border) bg-white px-2.5 py-2">
              <Checkbox checked={a.isDone} onCheckedChange={(v) => toggleAction(a.id, Boolean(v))} />
              <span className={cn("flex-1 text-[13px]", a.isDone && "text-slate-400 line-through")}>{a.title}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input placeholder="مورد اقدام جدید..." value={newAction} onChange={(e) => setNewAction(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addActionItem()} />
          <Button variant="secondary" onClick={addActionItem}>افزودن</Button>
        </div>
      </div>

      {meeting.participants.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-(--color-muted)">شرکت‌کنندگان</p>
          <div className="flex flex-wrap gap-1.5">
            {meeting.participants.map((p) => <Badge key={p.id} variant="outline">{p.name}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}
