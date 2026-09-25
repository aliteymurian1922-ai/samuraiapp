import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (error) {
    const details =
      error instanceof Error
        ? { name: error.name, message: error.message, code: (error as Error & { code?: string }).code }
        : { name: "UnknownError", message: String(error) };

    console.error("[health] database check failed", details);

    return Response.json(
      {
        ok: false,
        databaseConfigured: Boolean(process.env.DATABASE_URL),
      },
      { status: 500 },
    );
  }
}
