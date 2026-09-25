/**
 * Samurai Risk Engine
 * Produces a deterministic 0-100 health score for a project based on
 * measurable signals. This score is what both the UI and the AI layer
 * use — the AI never invents a number, it only interprets this one.
 */
export type RiskInput = {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  dueWithin3Days: number;
  progress: number; // 0-100 recorded progress
  daysSinceLastActivity: number;
  isPastDueDate: boolean;
};

export type RiskLevel = "healthy" | "at_risk" | "critical";

export type RiskResult = {
  score: number;
  level: RiskLevel;
  factors: { label: string; impact: number }[];
};

export function computeProjectHealth(input: RiskInput): RiskResult {
  let score = 100;
  const factors: { label: string; impact: number }[] = [];

  if (input.totalTasks === 0) {
    return { score: 100, level: "healthy", factors: [{ label: "پروژه هنوز وظیفه‌ای ندارد", impact: 0 }] };
  }

  const overdueRatio = input.overdueTasks / input.totalTasks;
  if (overdueRatio > 0) {
    const impact = Math.min(45, Math.round(overdueRatio * 100 * 0.6));
    score -= impact;
    factors.push({ label: `${input.overdueTasks} وظیفه عقب‌افتاده`, impact });
  }

  const blockedRatio = input.blockedTasks / input.totalTasks;
  if (blockedRatio > 0) {
    const impact = Math.min(20, Math.round(blockedRatio * 100 * 0.4));
    score -= impact;
    factors.push({ label: `${input.blockedTasks} وظیفه مسدودشده`, impact });
  }

  if (input.isPastDueDate) {
    score -= 20;
    factors.push({ label: "موعد پروژه گذشته است", impact: 20 });
  } else if (input.dueWithin3Days > 0 && input.completedTasks / input.totalTasks < 0.7) {
    score -= 10;
    factors.push({ label: "نزدیک شدن به ددلاین با پیشرفت ناکافی", impact: 10 });
  }

  if (input.daysSinceLastActivity >= 7) {
    const impact = Math.min(15, input.daysSinceLastActivity - 5);
    score -= impact;
    factors.push({ label: `${input.daysSinceLastActivity} روز بدون فعالیت`, impact });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const level: RiskLevel = score >= 75 ? "healthy" : score >= 45 ? "at_risk" : "critical";

  return { score, level, factors: factors.sort((a, b) => b.impact - a.impact) };
}

export const RISK_LEVEL_LABEL_FA: Record<RiskLevel, string> = {
  healthy: "سالم",
  at_risk: "در معرض خطر",
  critical: "بحرانی",
};
