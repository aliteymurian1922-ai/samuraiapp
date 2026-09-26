import { describe, expect, it } from "vitest";
import { parseCsv } from "@/components/crm/crm-import-dialog";

describe("parseCsv", () => {
  it("parses comma CSV with quoted commas", () => {
    const result = parseCsv('name,company,email\n"علی","فروش، توسعه و خدمات","ali@example.com"\n');

    expect(result.headers).toEqual(["name", "company", "email"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("علی");
    expect(result.rows[0].company).toBe("فروش، توسعه و خدمات");
  });

  it("parses semicolon CSV and strips BOM", () => {
    const result = parseCsv("\uFEFFنام;تلفن\nعلی;09120000000\n");

    expect(result.headers).toEqual(["نام", "تلفن"]);
    expect(result.rows[0]["تلفن"]).toBe("09120000000");
  });

  it("supports escaped double quotes", () => {
    const result = parseCsv('name,notes\nعلی,"گفت ""سلام"""\n');

    expect(result.rows[0].notes).toBe('گفت "سلام"');
  });
});
