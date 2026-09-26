"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatJalaliDate } from "@/lib/date";
import { toPersianDigits } from "@/lib/utils";

type TimelineTask = {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  statusIsDone: boolean;
  statusName: string;
  statusColor: string | null;
  priority: string;
  assigneeName: string | null;
};

type Props = {
  tasks: TimelineTask[];
  onTaskClick: (taskId: string) => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CELL_WIDTH = 34;
const LABEL_WIDTH = 220;

function utcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dayDiff(a: Date, b: Date) {
  return Math.round((utcDay(b) - utcDay(a)) / DAY_MS);
}

function addDays(date: Date, amount: number) {
  return new Date(utcDay(date) + amount * DAY_MS);
}

function getTaskRange(task: TimelineTask) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const start = task.startDate ? new Date(task.startDate) : due;
  if (!start && !due) return null;
  return {
    start: start ?? due!,
    end: due ?? start!,
  };
}

function priorityLabel(priority: string) {
  if (priority === "critical") return "بحرانی";
  if (priority === "high") return "بالا";
  if (priority === "low") return "کم";
  return "متوسط";
}

export function ProjectTimeline({ tasks, onTaskClick }: Props) {
  const datedTasks = useMemo(
    () => tasks.map((task) => ({ task, range: getTaskRange(task) })).filter((item) => item.range),
    [tasks],
  );

  const model = useMemo(() => {
    if (datedTasks.length === 0) return null;

    const dates = datedTasks.flatMap(({ range }) => [range!.start.getTime(), range!.end.getTime()]);
    const today = new Date();

    let start = new Date(Math.min(...dates, today.getTime()));
    let end = new Date(Math.max(...dates, today.getTime()));

    start = addDays(start, -2);
    end = addDays(end, 4);

    const totalDays = Math.max(7, dayDiff(start, end) + 1);
    const days = Array.from({ length: totalDays }, (_, index) => addDays(start, index));

    return { start, end, totalDays, days };
  }, [datedTasks]);

  if (!model) {
    return (
      <EmptyState
        title="برای خط زمان، تاریخ لازم است"
        description="برای وظایف تاریخ شروع یا موعد تعیین کنید تا برنامه زمانی پروژه اینجا نمایش داده شود."
      />
    );
  }

  const today = new Date();
  const todayIndex = dayDiff(model.start, today);
  const timelineWidth = model.totalDays * CELL_WIDTH;

  return (
    <div className="overflow-hidden rounded-2xl border border-(--color-border) bg-white">
      <div className="overflow-x-auto">
        <div style={{ minWidth: LABEL_WIDTH + timelineWidth }}>
          <div className="sticky top-0 z-10 flex border-b border-(--color-border) bg-white">
            <div
              className="sticky right-0 z-20 shrink-0 border-l border-(--color-border) bg-white px-4 py-3"
              style={{ width: LABEL_WIDTH }}
            >
              <p className="text-xs font-bold text-(--color-text)">وظیفه</p>
              <p className="mt-0.5 text-[10px] text-(--color-muted)">بازه زمانی پروژه</p>
            </div>

            <div className="relative flex shrink-0" style={{ width: timelineWidth }}>
              {model.days.map((day, index) => {
                const isToday = index === todayIndex;
                const isWeekend = day.getUTCDay() === 5;
                return (
                  <div
                    key={day.toISOString()}
                    className={`shrink-0 border-l border-slate-100 px-1 py-2 text-center ${isToday ? "bg-indigo-50" : isWeekend ? "bg-slate-50" : ""}`}
                    style={{ width: CELL_WIDTH }}
                  >
                    <p className={`text-[9px] ${isToday ? "font-bold text-(--color-primary)" : "text-slate-400"}`}>
                      {toPersianDigits(day.getUTCDate())}
                    </p>
                    <p className="text-[8px] text-slate-300">
                      {day.toLocaleDateString("fa-IR", { month: "short", timeZone: "UTC" })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative">
            {todayIndex >= 0 && todayIndex < model.totalDays && (
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-[5] w-px bg-(--color-danger)/45"
                style={{ right: LABEL_WIDTH + todayIndex * CELL_WIDTH + CELL_WIDTH / 2 }}
                aria-hidden="true"
              />
            )}

            {datedTasks.map(({ task, range }) => {
              const startIndex = Math.max(0, dayDiff(model.start, range!.start));
              const endIndex = Math.min(model.totalDays - 1, dayDiff(model.start, range!.end));
              const span = Math.max(1, endIndex - startIndex + 1);
              const overdue = Boolean(
                task.dueDate &&
                  !task.statusIsDone &&
                  new Date(task.dueDate).getTime() < today.getTime(),
              );

              return (
                <div key={task.id} className="flex min-h-16 border-b border-slate-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onTaskClick(task.id)}
                    className="sticky right-0 z-10 flex shrink-0 items-center gap-2 border-l border-(--color-border) bg-white px-4 py-3 text-right transition hover:bg-slate-50"
                    style={{ width: LABEL_WIDTH }}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: task.statusColor ?? "#94a3b8" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-(--color-text)">
                        {task.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-(--color-muted)">
                        {task.assigneeName || "بدون مسئول"} · {priorityLabel(task.priority)}
                      </span>
                    </span>
                  </button>

                  <div
                    className="relative shrink-0"
                    style={{
                      width: timelineWidth,
                      backgroundImage:
                        "repeating-linear-gradient(to left, transparent 0, transparent 33px, rgba(226,232,240,.65) 33px, rgba(226,232,240,.65) 34px)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onTaskClick(task.id)}
                      className={`absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-lg px-2 text-[10px] font-semibold text-white shadow-sm transition hover:brightness-95 ${overdue ? "bg-(--color-danger)" : task.statusIsDone ? "bg-(--color-success)" : "bg-(--color-primary)"}`}
                      style={{
                        right: startIndex * CELL_WIDTH + 3,
                        width: Math.max(28, span * CELL_WIDTH - 6),
                      }}
                      title={`${task.title} · ${formatJalaliDate(range!.start)} تا ${formatJalaliDate(range!.end)}`}
                    >
                      <span className="truncate">{task.title}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-(--color-border) bg-slate-50 px-4 py-2 text-[10px] text-(--color-muted)">
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-(--color-primary)" /> در حال انجام</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-(--color-success)" /> تکمیل‌شده</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-(--color-danger)" /> عقب‌افتاده</span>
        <span className="mr-auto">خط قرمز باریک: امروز</span>
      </div>
    </div>
  );
}
