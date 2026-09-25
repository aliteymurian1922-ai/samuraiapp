"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "on_hold" | "completed" | "archived";
  priority: "critical" | "high" | "medium" | "low";
  color: string | null;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  stats: { total: number; completed: number; overdue: number };
  health: { score: number; level: "healthy" | "at_risk" | "critical"; factors: { label: string; impact: number }[] };
};

export type MemberSummary = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  avatarColor: string | null;
  role: "owner" | "admin" | "manager" | "member" | "viewer";
  joinedAt: string;
};

export type TagSummary = { id: string; name: string; color: string | null };

export type TaskRow = {
  id: string;
  projectId: string;
  statusId: string;
  title: string;
  description: string | null;
  priority: "critical" | "high" | "medium" | "low";
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
  statusName: string;
  statusColor: string | null;
  statusIsDone: boolean;
  projectName: string;
  projectColor: string | null;
  dueDate: string | null;
  startDate: string | null;
  estimatedMinutes: number | null;
  position: number;
  parentTaskId: string | null;
  createdAt: string;
};

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<{ projects: ProjectSummary[] }>("/api/projects"),
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: () => api.get<{ members: MemberSummary[] }>("/api/members"),
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => api.get<{ tags: TagSummary[] }>("/api/tags"),
  });
}

export function useTasks(filters: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
  const qs = params.toString();
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => api.get<{ tasks: TaskRow[] }>(`/api/tasks${qs ? `?${qs}` : ""}`),
  });
}

export function useProjectStatuses(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId, "detail"],
    queryFn: () => api.get<{ project: unknown; statuses: { id: string; name: string; color: string | null; isDone: boolean; order: number }[]; members: MemberSummary[] }>(`/api/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/dashboard"),
  });
}

export type TaskDetail = TaskRow & {
  subtasks: TaskRow[];
  tags: TagSummary[];
  checklist: { id: string; title: string; isDone: boolean; order: number }[];
  comments: { id: string; body: string; createdAt: string; authorId: string | null; authorName: string | null; authorColor: string | null }[];
  attachments: { id: string; fileName: string; fileUrl: string; fileType: string | null; createdAt: string }[];
  dependencies: { id: string; type: string; dependsOnTaskId: string; title: string; isDone: boolean }[];
  timeEntries: { id: string; startedAt: string; endedAt: string | null; durationMinutes: number | null }[];
};

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api.get<{ task: TaskDetail }>(`/api/tasks/${taskId}`),
    enabled: Boolean(taskId),
  });
}

export function useMeetings() {
  return useQuery({
    queryKey: ["meetings"],
    queryFn: () => api.get<{ meetings: { id: string; title: string; startTime: string; endTime: string; location: string | null; projectId: string | null }[] }>("/api/meetings"),
  });
}
