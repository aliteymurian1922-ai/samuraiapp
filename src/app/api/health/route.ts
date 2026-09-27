import { pool } from "@/db";

export const dynamic = "force-dynamic";

function getConnectionMeta() {
  const source = process.env.DATABASE_URL
    ? "DATABASE_URL"
    : process.env.POSTGRES_URL
      ? "POSTGRES_URL"
      : null;

  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) {
    return { source, host: null, port: null, sslMode: null };
  }

  try {
    const url = new URL(raw);
    return {
      source,
      host: url.hostname,
      port: url.port || "5432",
      sslMode: url.searchParams.get("sslmode"),
    };
  } catch {
    return { source, host: "invalid-url", port: null, sslMode: null };
  }
}

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
    const connection = getConnectionMeta();

    console.error("[health] database check failed", {
      ...details,
      connection,
    });

    return Response.json(
      {
        ok: false,
        databaseConfigured: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
        authConfigured: Boolean(process.env.AUTH_SECRET),
        emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
        databaseSource: connection.source,
      },
      { status: 500 },
    );
  }
}
