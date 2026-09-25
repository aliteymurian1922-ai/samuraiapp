"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useUIStore } from "@/stores/ui-store";
import { toJalali, getJalaliMonthGrid, shiftJalaliMonth, JALALI_MONTHS, JALALI_WEEKDAYS_SHORT } from "@/lib/date";
import { toPersianDigits, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronLeft, Plus, Video } from "lucide-react";
import type { TaskRow } from "@/hooks/use-data";
import { useTasks, useMeetings } from "@/hooks/use-data";

export default function CalendarPage() {
  const today = new Date();
  const todayJalali = toJalali(today);
  const [jy, setJy] = useState(todayJalali.jy);
  const [jm, setJm] = useState(todayJalali.jm);
  const { setActiveTaskId, setCreateMeetingOpen } = useUIStore();

  const grid = useMemo(() => getJalaliMonthGrid(jy, jm), [jy, jm]);
  const { data: tasksData } = useTasks({});
  const { data: meetingsData } = useMeetings();

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const t of tasksData?.tasks ?? []) {
      if (!t.dueDate) continue;
      const key = new Date(t.dueDate).toDateString();
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [tasksData]);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, { id: string; title: string; startTime: string }[]>();
    for (const m of meetingsData?.meetings ?? []) {
      const key = new Date(m.startTime).toDateString();
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    return map;
  }, [meetingsData]);

  function goToday() {
    setJy(todayJalali.jy);
    setJm(todayJalali.jm);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-bold">تقویم</h1>
          <p className="text-xs text-(--color-muted)">وظایف و جلسات بر اساس تقویم شمسی</p>
        </div>
        <Button size="sm" onClick={() => setCreateMeetingOpen(true)}><Plus className="size-4" /> جلسه جدید</Button>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => { const r = shiftJalaliMonth(jy, jm, -1); setJy(r.jy); setJm(r.jm); }} className="rounded-lg p-1.5 hover:bg-slate-100">
              <ChevronRight className="size-4" />
            </button>
            <button onClick={() => { const r = shiftJalaliMonth(jy, jm, 1); setJy(r.jy); setJm(r.jm); }} className="rounded-lg p-1.5 hover:bg-slate-100">
              <ChevronLeft className="size-4" />
            </button>
          </div>
          <p className="text-sm font-bold">{JALALI_MONTHS[jm - 1]} {toPersianDigits(jy)}</p>
          <button onClick={goToday} className="rounded-lg border border-(--color-border) px-2.5 py-1 text-xs font-medium hover:bg-slate-50">امروز</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-(--color-muted)">
          {JALALI_WEEKDAYS_SHORT.map((d) => <div key={d} className="py-1.5">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: grid.offset }).map((_, i) => <div key={`empty-${i}`} />)}
          {grid.days.map(({ jd, date }) => {
            const isToday = date.toDateString() === today.toDateString();
            const dayTasks = tasksByDay.get(date.toDateString()) ?? [];
            const dayMeetings = meetingsByDay.get(date.toDateString()) ?? [];
            return (
              <div
                key={jd}
                className={cn(
                  "min-h-[5.5rem] rounded-xl border p-1.5 text-right sm:min-h-[6.5rem]",
                  isToday ? "border-(--color-primary) bg-(--color-primary-soft)" : "border-(--color-border) bg-white",
                )}
              >
                <p className={cn("text-[11px] font-semibold", isToday && "text-(--color-primary)")}>{toPersianDigits(jd)}</p>
                <div className="mt-1 space-y-1">
                  {dayMeetings.slice(0, 1).map((m) => (
                    <div key={m.id} className="flex items-center gap-1 truncate rounded-md bg-violet-100 px-1 py-0.5 text-[10px] text-violet-700">
                      <Video className="size-2.5 shrink-0" /> {m.title}
                    </div>
                  ))}
                  {dayTasks.slice(0, 2).map((t) => (
                    <button key={t.id} onClick={() => setActiveTaskId(t.id)} className="block w-full truncate rounded-md bg-slate-100 px-1 py-0.5 text-right text-[10px] text-(--color-text) hover:bg-slate-200">
                      {t.title}
                    </button>
                  ))}
                  {dayTasks.length > 2 && <Badge variant="outline" className="text-[9px]">+{toPersianDigits(dayTasks.length - 2)}</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
