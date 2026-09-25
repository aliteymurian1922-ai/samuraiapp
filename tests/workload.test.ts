import { describe, expect, it } from "vitest";
import { classifyWorkload, overloadHours } from "@/lib/workload";

describe("workload", () => {
  it("classifies common load bands", () => {
    expect(classifyWorkload(500, 2400)).toBe("low");
    expect(classifyWorkload(1600, 2400)).toBe("balanced");
    expect(classifyWorkload(2500, 2400)).toBe("high");
    expect(classifyWorkload(3000, 2400)).toBe("overloaded");
  });

  it("returns overload hours only above capacity", () => {
    expect(overloadHours(2400, 2400)).toBe(0);
    expect(overloadHours(2700, 2400)).toBe(5);
  });
});
