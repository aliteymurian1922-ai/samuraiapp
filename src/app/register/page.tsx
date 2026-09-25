"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { api, ClientApiError } from "@/lib/api-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    try {
      await api.post("/api/auth/register", values);
      toast.success("حساب کاربری با موفقیت ایجاد شد.");
      router.push("/onboarding");
      router.refresh();
    } catch (error) {
      setServerError(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  return (
    <AuthShell
      title="ساخت حساب کاربری در سامورایی"
      description="در کمتر از یک دقیقه شروع کنید."
      footer={
        <span>
          قبلاً حساب دارید؟{" "}
          <Link href="/login" className="font-medium text-(--color-primary)">
            ورود
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="name">نام و نام خانوادگی</Label>
          <Input id="name" autoComplete="name" placeholder="مثلاً امیر رضایی" {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-(--color-danger)">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="email">ایمیل</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-(--color-danger)">{errors.email.message}</p>}
        </div>
        <div>
          <Label htmlFor="password">رمز عبور</Label>
          <Input id="password" type="password" autoComplete="new-password" placeholder="حداقل ۸ کاراکتر" {...register("password")} />
          {errors.password && <p className="mt-1 text-xs text-(--color-danger)">{errors.password.message}</p>}
        </div>

        {serverError && <p className="rounded-lg bg-(--color-danger-soft) px-3 py-2 text-xs text-(--color-danger)">{serverError}</p>}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          ساخت حساب کاربری
        </Button>
      </form>
    </AuthShell>
  );
}
