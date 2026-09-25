import { describe, expect, it } from "vitest";
import { can, isAtLeast } from "@/lib/permissions";

describe("permissions", () => {
  it("allows owners to manage and delete a workspace", () => {
    expect(can("owner", "workspace.manage")).toBe(true);
    expect(can("owner", "workspace.delete")).toBe(true);
  });

  it("keeps viewers read-only for write capabilities", () => {
    expect(can("viewer", "project.create")).toBe(false);
    expect(can("viewer", "task.create")).toBe(false);
    expect(can("viewer", "ai.use")).toBe(true);
  });

  it("orders roles consistently", () => {
    expect(isAtLeast("admin", "manager")).toBe(true);
    expect(isAtLeast("member", "manager")).toBe(false);
  });
});
