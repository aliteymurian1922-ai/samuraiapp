import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

let localPool: Pool | undefined;
let localDb: ReturnType<typeof drizzle> | undefined;

function getPool() {
  if (process.env.NODE_ENV !== "production" && globalForDb.__arenaNextJsPostgresqlPool) {
    return globalForDb.__arenaNextJsPostgresqlPool;
  }

  if (localPool) return localPool;

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or POSTGRES_URL is required at runtime");
  }

  localPool = new Pool({ connectionString: databaseUrl });

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
