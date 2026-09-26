import "server-only";

import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { ApiError } from "@/lib/api-response";

type RateLimitOptions = {
  scope: string;
  identifier: string;
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
};

function rateLimitSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for rate limiting.");
  return secret;
}

function keyHash(scope: string, identifier: string) {
  return createHmac("sha256", rateLimitSecret())
    .update(scope)
    .update("\0")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

export function getRequestIp(request: NextRequest): string | null {
  const candidates = [
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  ];

  for (const candidate of candidates) {
    const ip = candidate?.split(",")[0]?.trim();
    if (ip) return ip.slice(0, 64);
  }

  return null;
}

export async function enforceRateLimit(options: RateLimitOptions) {
  const hash = keyHash(options.scope, options.identifier);
  const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
  const blockSeconds = Math.max(1, Math.ceil(options.blockMs / 1000));

  const result = await db.execute(sql`
    insert into ${rateLimits} (
      key_hash,
      scope,
      attempts,
      window_started_at,
      blocked_until,
      updated_at
    )
    values (
      ${hash},
      ${options.scope},
      1,
      now(),
      null,
      now()
    )
    on conflict (key_hash) do update
    set
      scope = excluded.scope,
      attempts = case
        when ${rateLimits.blockedUntil} > now() then ${rateLimits.attempts}
        when (
          ${rateLimits.blockedUntil} is not null
          and ${rateLimits.blockedUntil} <= now()
        ) or ${rateLimits.windowStartedAt} <= now() - make_interval(secs => ${windowSeconds})
          then 1
        else ${rateLimits.attempts} + 1
      end,
      window_started_at = case
        when ${rateLimits.blockedUntil} > now() then ${rateLimits.windowStartedAt}
        when (
          ${rateLimits.blockedUntil} is not null
          and ${rateLimits.blockedUntil} <= now()
        ) or ${rateLimits.windowStartedAt} <= now() - make_interval(secs => ${windowSeconds})
          then now()
        else ${rateLimits.windowStartedAt}
      end,
      blocked_until = case
        when ${rateLimits.blockedUntil} > now() then ${rateLimits.blockedUntil}
        when (
          ${rateLimits.blockedUntil} is not null
          and ${rateLimits.blockedUntil} <= now()
        ) or ${rateLimits.windowStartedAt} <= now() - make_interval(secs => ${windowSeconds})
          then null
        when ${rateLimits.attempts} + 1 > ${options.maxAttempts}
          then now() + make_interval(secs => ${blockSeconds})
        else null
      end,
      updated_at = now()
    returning attempts, blocked_until
  `);

  const row = result.rows[0] as { attempts?: unknown; blocked_until?: unknown } | undefined;
  const blockedUntil = row?.blocked_until ? new Date(String(row.blocked_until)) : null;

  if (blockedUntil && blockedUntil.getTime() > Date.now()) {
    throw new ApiError(
      "تعداد تلاش‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
      429,
    );
  }

  return {
    attempts: Number(row?.attempts ?? 1),
    blockedUntil,
  };
}

export async function clearRateLimit(scope: string, identifier: string) {
  const hash = keyHash(scope, identifier);
  await db.delete(rateLimits).where(sql`${rateLimits.keyHash} = ${hash}`);
}
