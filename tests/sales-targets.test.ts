import { describe, expect, it } from "vitest";
import {
  salesTargetMonthSchema,
  updateSalesTargetsSchema,
} from "@/lib/validation/sales-targets";

describe("sales target validation", () => {
  it("accepts a valid YYYY-MM month", () => {
    expect(salesTargetMonthSchema.parse("2026-09")).toBe("2026-09");
  });

  it("rejects invalid months", () => {
    expect(() => salesTargetMonthSchema.parse("2026-13")).toThrow();
    expect(() => salesTargetMonthSchema.parse("1405/07")).toThrow();
  });

  it("validates workspace and member targets", () => {
    const result = updateSalesTargetsSchema.parse({
      month: "2026-09",
      workspaceTarget: 500000000,
      memberTargets: [
        {
          userId: "11111111-1111-4111-8111-111111111111",
          targetValue: 200000000,
        },
      ],
    });

    expect(result.workspaceTarget).toBe(500000000);
    expect(result.memberTargets[0].targetValue).toBe(200000000);
  });

  it("rejects negative targets", () => {
    expect(() =>
      updateSalesTargetsSchema.parse({
        month: "2026-09",
        workspaceTarget: -1,
        memberTargets: [],
      }),
    ).toThrow();
  });
});
