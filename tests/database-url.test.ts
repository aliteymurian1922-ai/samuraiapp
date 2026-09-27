import { describe, expect, it } from "vitest";
import { getConfiguredDatabaseUrl, normalizeDatabaseUrl } from "@/db";

describe("normalizeDatabaseUrl", () => {
  it("qualifies a plain postgres user for the Samurai Supabase transaction pooler", () => {
    const result = new URL(
      normalizeDatabaseUrl(
        "postgresql://postgres:secret@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
      ),
    );

    expect(result.username).toBe("postgres.hyqmntpbnxkbnsqbcelj");
    expect(result.searchParams.get("sslmode")).toBe("require");
    expect(result.searchParams.get("uselibpqcompat")).toBe("true");
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


describe("getConfiguredDatabaseUrl", () => {
  it("prefers POSTGRES_URL when both variables exist", () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousPostgresUrl = process.env.POSTGRES_URL;

    process.env.DATABASE_URL = "postgresql://broken:broken@db.invalid:5432/broken";
    process.env.POSTGRES_URL = "postgresql://healthy:healthy@db.example.com:5432/app";

    expect(getConfiguredDatabaseUrl()).toEqual({
      source: "POSTGRES_URL",
      value: process.env.POSTGRES_URL,
    });

    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;

    if (previousPostgresUrl === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = previousPostgresUrl;
  });

  it("falls back to DATABASE_URL when POSTGRES_URL is absent", () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousPostgresUrl = process.env.POSTGRES_URL;

    delete process.env.POSTGRES_URL;
    process.env.DATABASE_URL = "postgresql://app:secret@db.example.com:5432/app";

    expect(getConfiguredDatabaseUrl()).toEqual({
      source: "DATABASE_URL",
      value: process.env.DATABASE_URL,
    });

    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;

    if (previousPostgresUrl === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = previousPostgresUrl;
  });
});
