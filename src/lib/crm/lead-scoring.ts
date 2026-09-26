export type LeadScoreBand = "hot" | "warm" | "cold" | "inactive" | "converted";

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

  return {
    score,
    band,
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
