import { Pool } from "pg";
import {
  getDatabaseConnectionMeta,
  normalizeDatabaseUrl,
  pool,
} from "@/db";

export const dynamic = "force-dynamic";

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { name: "UnknownError", message: String(error), code: null, cause: null };
  }

  const typed = error as Error & {
    code?: string;
    errno?: string | number;
    syscall?: string;
    hostname?: string;
    address?: string;
    port?: number;
    cause?: unknown;
  };

  const cause =
    typed.cause instanceof Error
      ? {
          name: typed.cause.name,
          message: typed.cause.message,
          code: (typed.cause as Error & { code?: string }).code ?? null,
        }
      : null;

  return {
    name: typed.name,
    message: typed.message,
    code: typed.code ?? null,
    errno: typed.errno ?? null,
    syscall: typed.syscall ?? null,
    hostname: typed.hostname ?? null,
    address: typed.address ?? null,
    port: typed.port ?? null,
    cause,
  };
}

async function probeCandidate(
  name: "DATABASE_URL" | "POSTGRES_URL",
  value: string | undefined,
) {
  if (!value) {
    return { configured: false, ok: false, code: null };
  }

  const candidatePool = new Pool({
    connectionString: normalizeDatabaseUrl(value),
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 1_000,
  });

  try {
    await candidatePool.query("select 1");
    return { configured: true, ok: true, code: null };
  } catch (error) {
    const details = errorDetails(error);
    console.error(`[health] ${name} probe failed`, {
      code: details.code,
      message: details.message,
    });
    return {
      configured: true,
      ok: false,
      code: details.code,
    };
  } finally {
    await candidatePool.end().catch(() => undefined);
  }
}

export async function GET() {
  try {
    await pool.query("select 1");

    return Response.json({
      ok: true,
      databaseConfigured: true,
      authConfigured: Boolean(process.env.AUTH_SECRET),
      emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    });
  } catch (error) {
    const details = errorDetails(error);
    const connection = getDatabaseConnectionMeta();

    const [databaseUrl, postgresUrl] = await Promise.all([
      probeCandidate("DATABASE_URL", process.env.DATABASE_URL),
      probeCandidate("POSTGRES_URL", process.env.POSTGRES_URL),
    ]);

    console.error("[health] database check failed", {
      ...details,
      connection,
      candidates: {
        DATABASE_URL: databaseUrl,
        POSTGRES_URL: postgresUrl,
      },
    });

    return Response.json(
      {
        ok: false,
        databaseConfigured: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
        authConfigured: Boolean(process.env.AUTH_SECRET),
        emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
        databaseSource: connection.source,
        databaseCandidates: {
          DATABASE_URL: databaseUrl,
          POSTGRES_URL: postgresUrl,
        },
      },
      { status: 500 },
    );
  }
}
