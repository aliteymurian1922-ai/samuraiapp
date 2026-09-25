"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import Link from "next/link";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { api, ClientApiError } from "@/lib/api-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { z } from "zod";

type FormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const res = await api.post<{ message: string; resetUrl: string | null }>("/api/auth/forgot-password", values);
      setMessage(res.message);
      setResetUrl(res.resetUrl);
    } catch (error) {
      setServerError(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  return (
    <AuthShell
      title="بازیابی رمز عبور"
      description="ایمیل حساب خود را وارد کنید."
      footer={
        <Link href="/login" className="font-medium text-(--color-primary)">
          بازگشت به ورود
        </Link>
      }
    >
      {!message ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
            {errors.email && <p className="mt-1 text-xs text-(--color-danger)">{errors.email.message}</p>}
          </div>
          {serverError && <p className="rounded-lg bg-(--color-danger-soft) px-3 py-2 text-xs text-(--color-danger)">{serverError}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>
            ارسال لینک بازیابی
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="rounded-lg bg-(--color-success-soft) px-3 py-2 text-xs text-(--color-success)">{message}</p>
          {resetUrl && (
            <Link href={resetUrl} className="block rounded-xl border border-(--color-border) px-3 py-2 text-center text-sm font-medium text-(--color-primary) hover:bg-slate-50">
              رفتن به صفحه تنظیم رمز جدید
            </Link>
          )}
        </div>
      )}
    </AuthShell>
  );
}
