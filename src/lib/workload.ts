/**
 * Workload classification for a team member for the current week.
 * capacityMinutes: expected working capacity (default 40h/week = 2400m)
 * assignedMinutes: sum of estimatedMinutes (fallback default) for open tasks
 */
export type WorkloadLevel = "low" | "balanced" | "high" | "overloaded";

export function classifyWorkload(assignedMinutes: number, capacityMinutes = 2400): WorkloadLevel {
  const ratio = capacityMinutes === 0 ? 0 : assignedMinutes / capacityMinutes;
  if (ratio < 0.4) return "low";
  if (ratio <= 0.85) return "balanced";
  if (ratio <= 1.15) return "high";
  return "overloaded";
}

export const WORKLOAD_LABEL_FA: Record<WorkloadLevel, string> = {
  low: "کم",
  balanced: "متعادل",
  high: "زیاد",
  overloaded: "بیش از ظرفیت",
};

export function overloadHours(assignedMinutes: number, capacityMinutes = 2400): number {
  const diff = assignedMinutes - capacityMinutes;
  return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
}
