import { describe, expect, it } from "vitest";
import { computeProjectHealth } from "@/lib/risk";

describe("computeProjectHealth", () => {
  it("returns a healthy score for a project without tasks", () => {
    expect(computeProjectHealth({
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      blockedTasks: 0,
      dueWithin3Days: 0,
      progress: 0,
      daysSinceLastActivity: 0,
      isPastDueDate: false,
    })).toMatchObject({ score: 100, level: "healthy" });
  });

  it("marks a severely delayed project as critical", () => {
    const result = computeProjectHealth({
      totalTasks: 10,
      completedTasks: 1,
      overdueTasks: 8,
      blockedTasks: 5,
      dueWithin3Days: 0,
      progress: 10,
      daysSinceLastActivity: 14,
      isPastDueDate: true,
    });
    expect(result.level).toBe("critical");
    expect(result.score).toBeLessThan(45);
  });
});
