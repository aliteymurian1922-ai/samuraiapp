import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/permissions";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "لطفاً ابتدا وارد حساب کاربری خود شوید.") {
    super(message, 401);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "موردی یافت نشد.") {
    super(message, 404);
  }
}

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return fail("داده‌های ارسالی نامعتبر است.", 422, error.flatten());
  }
  if (error instanceof ForbiddenError) {
    return fail(error.message, 403);
  }
  if (error instanceof ApiError) {
    return fail(error.message, error.status);
  }
  // eslint-disable-next-line no-console
  console.error("[api-error]", error);
  return fail("مشکلی در سرور پیش آمد. لطفاً دوباره تلاش کنید.", 500);
}

export function withApiHandler<T>(fn: () => Promise<T>) {
  return fn().catch((error) => {
    throw error;
  });
}
