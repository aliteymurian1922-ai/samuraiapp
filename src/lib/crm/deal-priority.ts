export type DealPriorityBand = "urgent" | "high" | "normal" | "low" | "done";

export type DealPriorityInput = {
  status: "open" | "won" | "lost";
  value: number;
  maxValue: number;
  probability: number;
  expectedCloseAt: Date | string | null;
  nextFollowUpAt: Date | string | null;
  reasons: string[];
  now?: Date;
};

export type DealPriorityResult = {
  priorityScore: number;
  priorityBand: DealPriorityBand;
  recommendedAction: string;
  reasons: string[];
};

function daysUntil(now: Date, value: Date | string) {
  return (new Date(value).getTime() - now.getTime()) / 86_400_000;
}

export function calculateDealPriority(input: DealPriorityInput): DealPriorityResult {
  if (input.status !== "open") {
    return {
      priorityScore: 0,
      priorityBand: "done",
      recommendedAction: input.status === "won"
        ? "این فرصت با موفقیت بسته شده است."
        : "این فرصت بسته شده و از صف اقدام فعال خارج است.",
      reasons: [],
    };
  }

  const now = input.now ?? new Date();
  const reasons = [...input.reasons];
  let urgency = 0;

  const closeDays = input.expectedCloseAt ? daysUntil(now, input.expectedCloseAt) : null;
  const followUpDays = input.nextFollowUpAt ? daysUntil(now, input.nextFollowUpAt) : null;

  if (closeDays !== null && closeDays < 0) urgency += 32;
  else if (closeDays !== null && closeDays <= 3) {
    urgency += 20;
    if (!reasons.includes("موعد بستن نزدیک است")) reasons.push("موعد بستن نزدیک است");
  } else if (closeDays !== null && closeDays <= 7) {
    urgency += 12;
  }

  if (!input.nextFollowUpAt) urgency += 28;
  else if (followUpDays !== null && followUpDays <= 1) urgency += 18;
  else if (followUpDays !== null && followUpDays <= 3) urgency += 10;

  if (input.probability <= 25) urgency += 14;

  const maxValue = Math.max(0, Number(input.maxValue || 0));
  const value = Math.max(0, Number(input.value || 0));
  const valuePoints = maxValue > 0
    ? Math.min(22, Math.max(3, Math.round((Math.log1p(value) / Math.log1p(maxValue)) * 22)))
    : 0;

  const priorityScore = Math.max(0, Math.min(100, Math.round(urgency + valuePoints)));
  const priorityBand: DealPriorityBand =
    priorityScore >= 72 ? "urgent" :
    priorityScore >= 52 ? "high" :
    priorityScore >= 30 ? "normal" :
    "low";

  let recommendedAction = "اقدام بعدی فرصت را بررسی و در موعد ثبت‌شده پیگیری کنید.";
  if (!input.nextFollowUpAt) {
    recommendedAction = "امروز یک اقدام بعدی و زمان پیگیری مشخص کنید.";
  } else if (closeDays !== null && closeDays < 0) {
    recommendedAction = "موعد بستن گذشته است؛ وضعیت واقعی فرصت و تاریخ جدید را امروز مشخص کنید.";
  } else if (followUpDays !== null && followUpDays <= 1) {
    recommendedAction = "پیگیری برنامه‌ریزی‌شده را امروز انجام دهید و نتیجه را ثبت کنید.";
  } else if (input.probability <= 25 && valuePoints >= 14) {
    recommendedAction = "مانع اصلی این فرصت باارزش را مشخص کنید و برای عبور از مرحله فعلی اقدام بگذارید.";
  }

  return {
    priorityScore,
    priorityBand,
    recommendedAction,
    reasons: reasons.slice(0, 4),
  };
}
