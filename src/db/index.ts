import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const SAMURAI_SUPABASE_PROJECT_REF = "hyqmntpbnxkbnsqbcelj";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

let localPool: Pool | undefined;
let localDb: ReturnType<typeof drizzle> | undefined;

export function getConfiguredDatabaseUrl() {
  if (process.env.POSTGRES_URL) {
    return { source: "POSTGRES_URL" as const, value: process.env.POSTGRES_URL };
  }

  if (process.env.DATABASE_URL) {
    return { source: "DATABASE_URL" as const, value: process.env.DATABASE_URL };
  }

  return { source: null, value: null };
}

export function normalizeDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const isSharedSupabasePooler =
    url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543";

  if (isSharedSupabasePooler && url.username === "postgres") {
    const projectRef =
      process.env.SUPABASE_PROJECT_REF?.trim() ||
      SAMURAI_SUPABASE_PROJECT_REF;

    url.username = `postgres.${projectRef}`;
  }

  if (isSharedSupabasePooler) {
    if (!url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }

    if (
      url.searchParams.get("sslmode") === "require" &&
      !url.searchParams.has("uselibpqcompat")
    ) {
      url.searchParams.set("uselibpqcompat", "true");
    }
  }

  return url.toString();
}

export function getDatabaseConnectionMeta() {
  const configured = getConfiguredDatabaseUrl();
  const source = configured.source;
  const raw = configured.value;
  if (!raw) {
    return {
      source,
      host: null,
      port: null,
      sslMode: null,
      usernameMode: null,
    };
  }

  try {
    const normalized = new URL(normalizeDatabaseUrl(raw));
    return {
      source,
      host: normalized.hostname,
      port: normalized.port || "5432",
      sslMode: normalized.searchParams.get("sslmode"),
      usernameMode: normalized.username.includes(".")
        ? "tenant-qualified"
        : "plain",
    };
  } catch {
    return {
      source,
      host: "invalid-url",
      port: null,
      sslMode: null,
      usernameMode: null,
    };
  }
}

function getPool() {
  if (process.env.NODE_ENV !== "production" && globalForDb.__arenaNextJsPostgresqlPool) {
    return globalForDb.__arenaNextJsPostgresqlPool;
  }

  if (localPool) return localPool;

  const configured = getConfiguredDatabaseUrl();
  if (!configured.value) {
    throw new Error("POSTGRES_URL or DATABASE_URL is required at runtime");
  }

  localPool = new Pool({
    connectionString: normalizeDatabaseUrl(configured.value),
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = localPool;
  }

  return localPool;
}

function getDb() {
  if (!localDb) {
    localDb = drizzle(getPool());
  }
  return localDb;
}

export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const realPool = getPool();
    const value = Reflect.get(realPool, property, realPool);
    return typeof value === "function" ? value.bind(realPool) : value;
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, property) {
    const realDb = getDb();
    const value = Reflect.get(realDb, property, realDb);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});
