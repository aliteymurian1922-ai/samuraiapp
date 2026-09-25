"use client";

import { useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { useUIStore } from "@/stores/ui-store";
import type { TaskRow } from "@/hooks/use-data";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatJalaliDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

type Status = { id: string; name: string; color: string | null; isDone: boolean; order: number };

const PRIORITY_COLOR: Record<string, string> = { critical: "#dc2626", high: "#d97706", medium: "#4f46e5", low: "#94a3b8" };

export function KanbanBoard({ statuses, tasks, projectId }: { statuses: Status[]; tasks: TaskRow[]; projectId: string }) {
  const queryClient = useQueryClient();
  const { setActiveTaskId, setCreateTaskOpen } = useUIStore();
  const [activeTask, setActiveTask] = useState<TaskRow | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const columns = useMemo(
    () => [...statuses].sort((a, b) => a.order - b.order).map((s) => ({ status: s, tasks: tasks.filter((t) => t.statusId === s.id).sort((a, b) => a.position - b.position) })),
    [statuses, tasks],
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const targetStatusId = over.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.statusId === targetStatusId) return;

    const targetTasks = tasks.filter((t) => t.statusId === targetStatusId);
    const newPosition = targetTasks.length > 0 ? Math.max(...targetTasks.map((t) => t.position)) + 1024 : 1024;

    queryClient.setQueryData<{ tasks: TaskRow[] } | undefined>(["tasks", { projectId }], (old) =>
      old ? { tasks: old.tasks.map((t) => (t.id === taskId ? { ...t, statusId: targetStatusId, position: newPosition } : t)) } : old,
    );

    try {
      await api.post(`/api/tasks/${taskId}/move`, { statusId: targetStatusId, position: newPosition });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.error(error instanceof ClientApiError ? error.message : "جابه‌جایی وظیفه ناموفق بود.");
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(({ status, tasks: colTasks }) => (
          <Column key={status.id} status={status} tasks={colTasks} onTaskClick={setActiveTaskId} onAdd={() => setCreateTaskOpen(true)} />
        ))}
      </div>
      <DragOverlay>{activeTask && <TaskCard task={activeTask} dragging />}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, tasks, onTaskClick, onAdd }: { status: Status; tasks: TaskRow[]; onTaskClick: (id: string) => void; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-2xl bg-slate-100/70 p-2.5 transition-colors", isOver && "bg-indigo-50")}>
      <div className="mb-2 flex items-center justify-between px-1.5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: status.color ?? "#94a3b8" }} />
          <span className="text-[13px] font-semibold">{status.name}</span>
          <span className="text-[11px] text-(--color-muted)">{tasks.length}</span>
        </div>
        <button onClick={onAdd} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-(--color-text)" aria-label="افزودن وظیفه">
          <Plus className="size-3.5" />
        </button>
      </div>
      <div className="flex min-h-[4rem] flex-col gap-2">
        {tasks.map((task) => (
          <DraggableCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ task, onClick }: { task: TaskRow; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn(isDragging && "opacity-30")}>
      <TaskCard task={task} onClick={onClick} />
    </div>
  );
}

function TaskCard({ task, onClick, dragging }: { task: TaskRow; onClick?: () => void; dragging?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full cursor-grab rounded-xl border border-(--color-border) bg-white p-3 text-right shadow-sm transition active:cursor-grabbing",
        dragging && "rotate-2 shadow-lg",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full" style={{ background: PRIORITY_COLOR[task.priority] }} />
        <p className="line-clamp-2 flex-1 text-[13px] font-medium text-(--color-text)">{task.title}</p>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        {task.dueDate ? (
          <Badge variant={new Date(task.dueDate).getTime() < new Date().getTime() ? "danger" : "outline"}>{formatJalaliDate(task.dueDate)}</Badge>
        ) : <span />}
        {task.assigneeName && <Avatar name={task.assigneeName} color={task.assigneeColor} size={22} />}
      </div>
    </button>
  );
}
