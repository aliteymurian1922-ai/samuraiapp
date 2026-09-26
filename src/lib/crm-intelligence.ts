export type LeadScoreInput = {
  status: "new" | "contacted" | "qualified" | "unqualified" | "converted";
  phone: string | null;
  email: string | null;
  companyName: string | null;
  source: string | null;
  estimatedValue: number | null;
  ownerId: string | null;
  notes: string | null;
  createdAt: Date | string;
  completedActivities: number;
  openActivities: number;
  overdueActivities: number;
  lastInteractionAt: Date | string | null;
  nextFollowUpAt: Date | string | null;
};

export type LeadScoreReason = {
  label: string;
  impact: number;
  kind: "positive" | "negative" | "neutral";
};

export type LeadScoreResult = {
  score: number;
  grade: "hot" | "warm" | "cold" | "inactive";
  reasons: LeadScoreReason[];
};

const STATUS_POINTS: Record<LeadScoreInput["status"], number> = {
  new: 10,
  contacted: 25,
  qualified: 45,
  unqualified: 0,
  converted: 100,
};

export function scoreLead(input: LeadScoreInput, now = new Date()): LeadScoreResult {
  if (input.status === "converted") {
    return {
      score: 100,
      grade: "hot",
      reasons: [{ label: "این سرنخ تبدیل شده است", impact: 100, kind: "positive" }],
    };
  }

  if (input.status === "unqualified") {
    return {
      score: 0,
      grade: "inactive",
      reasons: [{ label: "سرنخ نامناسب علامت‌گذاری شده", impact: 0, kind: "neutral" }],
    };
  }

  let score = STATUS_POINTS[input.status];
  const reasons: LeadScoreReason[] = [
    {
      label:
        input.status === "qualified"
          ? "واجد شرایط"
          : input.status === "contacted"
            ? "تماس اولیه انجام شده"
            : "سرنخ جدید",
      impact: STATUS_POINTS[input.status],
      kind: "positive",
    },
  ];

  const add = (label: string, impact: number, kind: LeadScoreReason["kind"] = "positive") => {
    score += impact;
    reasons.push({ label, impact, kind });
  };

  if (input.phone) add("شماره تماس ثبت شده", 8);
  if (input.email) add("ایمیل ثبت شده", 8);
  if (input.companyName) add("شرکت مشخص است", 5);
  if (input.source) add("منبع جذب مشخص است", 2);
  if (input.ownerId) add("مسئول فروش تعیین شده", 2);
  if (input.notes?.trim()) add("یادداشت نیاز یا گفتگو ثبت شده", 2);

  const value = Number(input.estimatedValue ?? 0);
  if (value > 0) {
    if (value >= 50_000_000) add("ارزش تقریبی بالا", 12);
    else if (value >= 10_000_000) add("ارزش تقریبی قابل توجه", 10);
    else add("ارزش تقریبی مشخص است", 8);
  }

  if (input.completedActivities > 0) {
    add(
      `${Math.min(input.completedActivities, 3).toLocaleString("fa-IR")} تعامل انجام‌شده`,
      Math.min(15, input.completedActivities * 5),
    );
  }

  if (input.nextFollowUpAt && input.openActivities > 0) {
    add("پیگیری بعدی برنامه‌ریزی شده", 5);
  }

  if (input.overdueActivities > 0) {
    add(
      `${input.overdueActivities.toLocaleString("fa-IR")} پیگیری عقب‌افتاده`,
      -10,
      "negative",
    );
  }

  const createdAt = new Date(input.createdAt).getTime();
  const ageDays = Math.floor((now.getTime() - createdAt) / 86_400_000);

  const lastInteractionAt = input.lastInteractionAt
    ? new Date(input.lastInteractionAt).getTime()
    : null;

  if (lastInteractionAt) {
    const interactionAgeDays = Math.floor((now.getTime() - lastInteractionAt) / 86_400_000);
    if (interactionAgeDays <= 7) add("تعامل در ۷ روز اخیر", 5);
    else if (interactionAgeDays > 30) add("بیش از ۳۰ روز از آخرین تعامل گذشته", -8, "negative");
  } else if (ageDays > 14) {
    add("بیش از ۱۴ روز بدون تعامل", -8, "negative");
  }

  const clamped = Math.max(0, Math.min(100, score));
  const grade: LeadScoreResult["grade"] =
    clamped >= 75 ? "hot" : clamped >= 50 ? "warm" : clamped >= 25 ? "cold" : "inactive";

  return {
    score: clamped,
    grade,
    reasons: reasons.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
  };
}

export type ForecastDealInput = {
  id: string;
  value: number;
  probability: number;
  expectedCloseAt: Date | string | null;
  ownerId: string | null;
  ownerName: string | null;
};

export function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildSalesForecast(deals: ForecastDealInput[], now = new Date()) {
  const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(startOfCurrentMonth.getUTCFullYear(), startOfCurrentMonth.getUTCMonth() + index, 1));
    return { key: monthKey(date), date: date.toISOString() };
  });

  const monthMap = new Map(
    monthKeys.map((month) => [
      month.key,
      {
        ...month,
        deals: 0,
        pipelineValue: 0,
        weightedForecast: 0,
        commitForecast: 0,
        bestCaseForecast: 0,
      },
    ]),
  );

  const ownerMap = new Map<
    string,
    {
      ownerId: string | null;
      ownerName: string;
      deals: number;
      pipelineValue: number;
      weightedForecast: number;
      commitForecast: number;
    }
  >();

  let pipelineValue = 0;
  let weightedForecast = 0;
  let commitForecast = 0;
  let bestCaseForecast = 0;
  let overdueValue = 0;
  let overdueDeals = 0;
  let noDateValue = 0;
  let noDateDeals = 0;

  for (const deal of deals) {
    const value = Number(deal.value ?? 0);
    const probability = Math.max(0, Math.min(100, Number(deal.probability ?? 0)));
    const weighted = Math.round((value * probability) / 100);

    pipelineValue += value;
    weightedForecast += weighted;
    if (probability >= 80) commitForecast += value;
    if (probability >= 50) bestCaseForecast += value;

    const ownerKey = deal.ownerId ?? "__unassigned__";
    const owner = ownerMap.get(ownerKey) ?? {
      ownerId: deal.ownerId,
      ownerName: deal.ownerName ?? "بدون مسئول",
      deals: 0,
      pipelineValue: 0,
      weightedForecast: 0,
      commitForecast: 0,
    };

    owner.deals += 1;
    owner.pipelineValue += value;
    owner.weightedForecast += weighted;
    if (probability >= 80) owner.commitForecast += value;
    ownerMap.set(ownerKey, owner);

    if (!deal.expectedCloseAt) {
      noDateDeals += 1;
      noDateValue += value;
      continue;
    }

    const closeAt = new Date(deal.expectedCloseAt);
    if (closeAt.getTime() < now.getTime()) {
      overdueDeals += 1;
      overdueValue += value;
      continue;
    }

    const month = monthMap.get(monthKey(closeAt));
    if (!month) continue;

    month.deals += 1;
    month.pipelineValue += value;
    month.weightedForecast += weighted;
    if (probability >= 80) month.commitForecast += value;
    if (probability >= 50) month.bestCaseForecast += value;
  }

  return {
    summary: {
      openDeals: deals.length,
      pipelineValue,
      weightedForecast,
      commitForecast,
      bestCaseForecast,
      overdueDeals,
      overdueValue,
      noDateDeals,
      noDateValue,
    },
    months: [...monthMap.values()],
    owners: [...ownerMap.values()].sort((a, b) => b.weightedForecast - a.weightedForecast),
  };
}
