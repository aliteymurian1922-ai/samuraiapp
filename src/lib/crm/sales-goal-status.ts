export type SalesGoalStatus =
  | "unset"
  | "achieved"
  | "forecast_risk"
  | "behind_pace"
  | "on_track";

export type SalesGoalEvaluation = {
  status: SalesGoalStatus;
  attainmentPercent: number;
  forecastAttainmentPercent: number;
  expectedPacePercent: number;
  message: string;
};

export function evaluateSalesGoalStatus(input: {
  targetValue: number;
  wonValue: number;
  forecastValue: number;
  now?: Date;
}): SalesGoalEvaluation {
  const targetValue = Math.max(0, Number(input.targetValue) || 0);
  const wonValue = Math.max(0, Number(input.wonValue) || 0);
  const forecastValue = Math.max(0, Number(input.forecastValue) || 0);
  const now = input.now ?? new Date();

  if (targetValue <= 0) {
    return {
      status: "unset",
      attainmentPercent: 0,
      forecastAttainmentPercent: 0,
      expectedPacePercent: 0,
      message: "برای این ماه هنوز هدف فروش ثبت نشده است.",
    };
  }

  const attainmentPercent = Math.round((wonValue / targetValue) * 100);
  const forecastAttainmentPercent = Math.round((forecastValue / targetValue) * 100);

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const expectedPacePercent = Math.round((dayOfMonth / daysInMonth) * 100);

  if (attainmentPercent >= 100) {
    return {
      status: "achieved",
      attainmentPercent,
      forecastAttainmentPercent,
      expectedPacePercent,
      message: "هدف قطعی فروش این ماه محقق شده است.",
    };
  }

  if (forecastAttainmentPercent < 80) {
    return {
      status: "forecast_risk",
      attainmentPercent,
      forecastAttainmentPercent,
      expectedPacePercent,
      message: `Forecast فعلی فقط ${forecastAttainmentPercent}٪ هدف ماه را پوشش می‌دهد.`,
    };
  }

  if (
    dayOfMonth >= 7 &&
    attainmentPercent < expectedPacePercent - 15
  ) {
    return {
      status: "behind_pace",
      attainmentPercent,
      forecastAttainmentPercent,
      expectedPacePercent,
      message: `فروش قطعی ${attainmentPercent}٪ هدف است؛ pace مورد انتظار تا امروز حدود ${expectedPacePercent}٪ است.`,
    };
  }

  return {
    status: "on_track",
    attainmentPercent,
    forecastAttainmentPercent,
    expectedPacePercent,
    message: "مسیر فعلی فروش با هدف ماه سازگار است.",
  };
}
