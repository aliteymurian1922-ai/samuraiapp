"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { api, ClientApiError } from "@/lib/api-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      await api.post("/api/auth/login", values);
      toast.success("خوش آمدید!");
      router.push("/app/dashboard");
      router.refresh();
    } catch (error) {
      setServerError(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  return (
    <AuthShell
      title="ورود به سامورایی"
      description="با ایمیل و رمز عبور خود وارد شوید."
      footer={
        <span>
          حساب کاربری ندارید؟{" "}
          <Link href="/register" className="font-medium text-(--color-primary)">
            ثبت‌نام کنید
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">ایمیل</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-(--color-danger)">{errors.email.message}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">رمز عبور</Label>
            <Link href="/forgot-password" className="text-xs text-(--color-primary)">
              فراموشی رمز عبور؟
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
          {errors.password && <p className="mt-1 text-xs text-(--color-danger)">{errors.password.message}</p>}
        </div>

        {serverError && <p className="rounded-lg bg-(--color-danger-soft) px-3 py-2 text-xs text-(--color-danger)">{serverError}</p>}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          ورود
        </Button>
      </form>
    </AuthShell>
  );
}
