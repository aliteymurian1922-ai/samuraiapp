import { describe, expect, it } from "vitest";
import { evaluateSalesGoalStatus } from "@/lib/crm/sales-goal-status";

describe("evaluateSalesGoalStatus", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");

  it("returns unset when no target exists", () => {
    expect(
      evaluateSalesGoalStatus({
        targetValue: 0,
        wonValue: 0,
        forecastValue: 0,
        now,
      }).status,
    ).toBe("unset");
  });

  it("marks a weak forecast as risk", () => {
    const result = evaluateSalesGoalStatus({
      targetValue: 100,
      wonValue: 20,
      forecastValue: 70,
      now,
    });

    expect(result.status).toBe("forecast_risk");
    expect(result.forecastAttainmentPercent).toBe(70);
  });

  it("marks sales as behind pace after the first week", () => {
    const result = evaluateSalesGoalStatus({
      targetValue: 100,
      wonValue: 20,
      forecastValue: 90,
      now,
    });

    expect(result.status).toBe("behind_pace");
    expect(result.expectedPacePercent).toBe(50);
  });

  it("returns on track when actual and forecast are healthy", () => {
    const result = evaluateSalesGoalStatus({
      targetValue: 100,
      wonValue: 45,
      forecastValue: 105,
      now,
    });

    expect(result.status).toBe("on_track");
  });

  it("marks achieved targets before other risk checks", () => {
    const result = evaluateSalesGoalStatus({
      targetValue: 100,
      wonValue: 110,
      forecastValue: 110,
      now,
    });

    expect(result.status).toBe("achieved");
  });
});
