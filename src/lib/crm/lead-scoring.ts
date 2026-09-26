export type LeadScoreBand = "hot" | "warm" | "cold" | "inactive" | "converted";
export type LeadPriorityBand = "urgent" | "high" | "normal" | "low" | "done";

export type LeadScoreInput = {
  status: "new" | "contacted" | "qualified" | "unqualified" | "converted";
  estimatedValue: number | null;
  maxEstimatedValue: number;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  source: string | null;
  ownerId: string | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  totalActivities: number;
  completedActivities: number;
  overdueFollowUps: number;
  nextFollowUpAt: Date | string | null;
  lastActivityAt: Date | string | null;
  now?: Date;
};

export type LeadScoreResult = {
  score: number;
  band: LeadScoreBand;
  priorityScore: number;
  priorityBand: LeadPriorityBand;
  recommendedAction: string;
  reasons: string[];
  breakdown: {
    status: number;
    value: number;
    completeness: number;
    engagement: number;
    followUp: number;
    freshness: number;
  };
};

function daysBetween(a: Date, b: Date) {
  return Math.max(0, (a.getTime() - b.getTime()) / 86_400_000);
}

export function calculateLeadScore(input: LeadScoreInput): LeadScoreResult {
  if (input.status === "converted") {
    return {
      score: 100,
      band: "converted",
      priorityScore: 0,
      priorityBand: "done",
      recommendedAction: "این سرنخ تبدیل شده و به اقدام فروش دیگری نیاز ندارد.",
      reasons: ["این سرنخ قبلاً به مشتری و فرصت فروش تبدیل شده است."],
      breakdown: {
        status: 30,
        value: 20,
        completeness: 15,
        engagement: 15,
        followUp: 15,
        freshness: 5,
      },
    };
  }

  if (input.status === "unqualified") {
    return {
      score: 0,
      band: "inactive",
      priorityScore: 0,
      priorityBand: "done",
      recommendedAction: "این سرنخ از صف پیگیری فعال خارج شده است.",
      reasons: ["این سرنخ در وضعیت نامناسب قرار دارد."],
      breakdown: {
        status: 0,
        value: 0,
        completeness: 0,
        engagement: 0,
        followUp: 0,
        freshness: 0,
      },
    };
  }

  const now = input.now ?? new Date();
  const reasons: string[] = [];

  const statusPoints =
    input.status === "qualified" ? 30 :
    input.status === "contacted" ? 18 :
    8;

  if (input.status === "qualified") reasons.push("سرنخ واجد شرایط است.");
  else if (input.status === "contacted") reasons.push("ارتباط اولیه با سرنخ برقرار شده است.");
  else reasons.push("سرنخ هنوز در مرحله اولیه است.");

  let valuePoints = 0;
  const value = Math.max(0, Number(input.estimatedValue ?? 0));
  const maxValue = Math.max(0, Number(input.maxEstimatedValue ?? 0));
  if (value > 0 && maxValue > 0) {
    const ratio = Math.log1p(value) / Math.log1p(maxValue);
    valuePoints = Math.max(4, Math.min(20, Math.round(ratio * 20)));
    if (valuePoints >= 15) reasons.push("ارزش تقریبی این سرنخ نسبتاً بالاست.");
  } else {
    reasons.push("ارزش تقریبی سرنخ ثبت نشده است.");
  }

  let completenessPoints = 0;
  if (input.phone) completenessPoints += 4;
  if (input.email) completenessPoints += 4;
  if (input.companyName) completenessPoints += 2;
  if (input.source) completenessPoints += 2;
  if (input.ownerId) completenessPoints += 2;
  if (input.notes) completenessPoints += 1;

  if (completenessPoints >= 12) reasons.push("اطلاعات سرنخ تقریباً کامل است.");
  else if (completenessPoints <= 6) reasons.push("اطلاعات تماس یا زمینه سرنخ ناقص است.");

  let engagementPoints = Math.min(12, Math.max(0, input.completedActivities) * 4);
  if (input.lastActivityAt) {
    const lastActivity = new Date(input.lastActivityAt);
    const age = daysBetween(now, lastActivity);
    if (age <= 7) {
      engagementPoints = Math.min(15, engagementPoints + 3);
      reasons.push("تعامل اخیر با این سرنخ ثبت شده است.");
    }
  } else {
    reasons.push("هنوز تعامل ثبت‌شده‌ای برای این سرنخ وجود ندارد.");
  }

  let followUpPoints = 0;
  if (input.overdueFollowUps > 0) {
    followUpPoints = -15;
    reasons.push("پیگیری عقب‌افتاده دارد.");
  } else if (input.nextFollowUpAt) {
    const nextFollowUp = new Date(input.nextFollowUpAt);
    const daysToFollowUp = (nextFollowUp.getTime() - now.getTime()) / 86_400_000;

    if (daysToFollowUp <= 3) {
      followUpPoints = 15;
      reasons.push("پیگیری بعدی در چند روز آینده برنامه‌ریزی شده است.");
    } else if (daysToFollowUp <= 7) {
      followUpPoints = 12;
      reasons.push("برای این سرنخ پیگیری آینده نزدیک ثبت شده است.");
    } else {
      followUpPoints = 8;
      reasons.push("برای این سرنخ اقدام بعدی مشخص شده است.");
    }
  } else {
    followUpPoints = -8;
    reasons.push("اقدام بعدی برای این سرنخ مشخص نشده است.");
  }

  const freshnessBase = input.lastActivityAt
    ? new Date(input.lastActivityAt)
    : new Date(input.updatedAt || input.createdAt);
  const staleDays = daysBetween(now, freshnessBase);

  let freshnessPoints = 0;
  if (staleDays <= 3) freshnessPoints = 5;
  else if (staleDays <= 7) freshnessPoints = 3;
  else if (staleDays <= 14) freshnessPoints = 1;
  else if (staleDays > 30) {
    freshnessPoints = -8;
    reasons.push("بیش از ۳۰ روز از آخرین حرکت روی این سرنخ گذشته است.");
  } else {
    freshnessPoints = -3;
    reasons.push("این سرنخ مدتی بدون حرکت مانده است.");
  }

  const raw =
    statusPoints +
    valuePoints +
    completenessPoints +
    engagementPoints +
    followUpPoints +
    freshnessPoints;

  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const band: LeadScoreBand =
    score >= 75 ? "hot" :
    score >= 50 ? "warm" :
    "cold";

  const daysToFollowUp = input.nextFollowUpAt
    ? (new Date(input.nextFollowUpAt).getTime() - now.getTime()) / 86_400_000
    : null;

  let urgencyPoints = 0;
  let recommendedAction = "اطلاعات سرنخ را کامل کنید و یک تماس اولیه ثبت کنید.";

  if (input.overdueFollowUps > 0) {
    urgencyPoints = Math.min(60, 50 + (input.overdueFollowUps - 1) * 5);
    recommendedAction = "پیگیری عقب‌افتاده را امروز انجام دهید و نتیجه را ثبت کنید.";
  } else if (daysToFollowUp !== null && daysToFollowUp <= 1) {
    urgencyPoints = 30;
    recommendedAction = "پیگیری برنامه‌ریزی‌شده را امروز انجام دهید.";
  } else if (daysToFollowUp !== null && daysToFollowUp <= 3) {
    urgencyPoints = 22;
    recommendedAction = "برای پیگیری نزدیک آماده شوید و هدف تماس را مشخص کنید.";
  } else if (!input.nextFollowUpAt) {
    urgencyPoints = 20;
    recommendedAction = "برای این سرنخ اقدام بعدی و زمان پیگیری تعیین کنید.";
  } else if (input.completedActivities === 0) {
    urgencyPoints = 14;
    recommendedAction = "پیش از موعد بعدی، اولین تعامل با سرنخ را ثبت کنید.";
  } else {
    urgencyPoints = 8;
    recommendedAction = "پیگیری برنامه‌ریزی‌شده را در موعد ثبت‌شده انجام دهید.";
  }

  if (staleDays > 30 && input.overdueFollowUps === 0) {
    urgencyPoints += 8;
    recommendedAction = "ارزش ادامه پیگیری را با یک تماس بازفعال‌سازی بررسی کنید.";
  }

  const priorityScore = Math.max(
    0,
    Math.min(100, Math.round(score * 0.65 + urgencyPoints)),
  );
  const priorityBand: LeadPriorityBand =
    priorityScore >= 75 ? "urgent" :
    priorityScore >= 58 ? "high" :
    priorityScore >= 35 ? "normal" :
    "low";

  return {
    score,
    band,
    priorityScore,
    priorityBand,
    recommendedAction,
    reasons: reasons.slice(0, 5),
    breakdown: {
      status: statusPoints,
      value: valuePoints,
      completeness: completenessPoints,
      engagement: engagementPoints,
      followUp: followUpPoints,
      freshness: freshnessPoints,
    },
  };
}
