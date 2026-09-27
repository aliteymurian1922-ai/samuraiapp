import { describe, expect, it } from "vitest";
import { summarizeLeadActivities } from "@/lib/crm/lead-activity-summary";

const now = new Date("2026-09-27T12:00:00Z");

describe("lead activity scoring inputs", () => {
  it("uses the latest created activity regardless of timeline ordering", () => {
    const activities = [
      { createdAt: "2026-08-01", completedAt: "2026-08-02", dueAt: "2026-08-02" },
      { createdAt: "2026-09-27T11:00:00Z", completedAt: null, dueAt: "2026-10-01" },
      { createdAt: "2026-09-20", completedAt: null, dueAt: null },
    ];
    const result = summarizeLeadActivities(activities, now);
    expect(result.lastActivityAt).toEqual(new Date("2026-09-27T11:00:00Z"));
    expect(summarizeLeadActivities([...activities].reverse(), now)).toEqual(result);
    expect(result.completedActivities).toBe(1);
    expect(result.openFollowUps).toBe(2);
  });

  it("separates overdue work from the earliest future open follow-up", () => {
    const result = summarizeLeadActivities([
      { createdAt: now, completedAt: null, dueAt: "2026-09-26" },
      { createdAt: now, completedAt: now, dueAt: "2026-09-28" },
      { createdAt: now, completedAt: null, dueAt: "2026-10-01" },
      { createdAt: now, completedAt: null, dueAt: "2026-09-29" },
    ], now);
    expect(result.overdueFollowUps).toBe(1);
    expect(result.nextFollowUpAt).toEqual(new Date("2026-09-29"));
  });

  it("treats a follow-up due exactly now as upcoming, matching SQL", () => {
    const result = summarizeLeadActivities([{ createdAt: now, dueAt: now, completedAt: null }], now);
    expect(result.overdueFollowUps).toBe(0);
    expect(result.nextFollowUpAt).toEqual(now);
  });

  it("does not invent a future follow-up when all remaining work is overdue", () => {
    const result = summarizeLeadActivities([{ createdAt: now, dueAt: "2026-09-26", completedAt: null }], now);
    expect(result.nextFollowUpAt).toBeNull();
    expect(result.overdueFollowUps).toBe(1);
    expect(summarizeLeadActivities([], now)).toEqual({
      totalActivities: 0, openFollowUps: 0, completedActivities: 0,
      overdueFollowUps: 0, nextFollowUpAt: null, lastActivityAt: null,
    });
  });
});
