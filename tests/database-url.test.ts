import { describe, expect, it } from "vitest";
import { normalizeDatabaseUrl } from "@/db";

describe("normalizeDatabaseUrl", () => {
  it("qualifies a plain postgres user for the Samurai Supabase transaction pooler", () => {
    const result = new URL(
      normalizeDatabaseUrl(
        "postgresql://postgres:secret@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
      ),
    );

    expect(result.username).toBe("postgres.hyqmntpbnxkbnsqbcelj");
    expect(result.searchParams.get("sslmode")).toBe("require");
  });

  it("does not modify an already tenant-qualified pooler username", () => {
    const result = new URL(
      normalizeDatabaseUrl(
        "postgresql://postgres.hyqmntpbnxkbnsqbcelj:secret@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
      ),
    );

    expect(result.username).toBe("postgres.hyqmntpbnxkbnsqbcelj");
    expect(result.searchParams.get("sslmode")).toBe("require");
  });

  it("leaves a regular PostgreSQL URL structurally unchanged", () => {
    const original = "postgresql://app:secret@db.example.com:5432/app_db";
    const result = new URL(normalizeDatabaseUrl(original));

    expect(result.username).toBe("app");
    expect(result.hostname).toBe("db.example.com");
    expect(result.port).toBe("5432");
    expect(result.searchParams.get("sslmode")).toBeNull();
  });
});
