"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { api, ClientApiError } from "@/lib/api-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { z } from "zod";

type FormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token } });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await api.post("/api/auth/reset-password", { ...values, token });
      toast.success("رمز عبور با موفقیت تغییر کرد.");
      router.push("/login");
    } catch (error) {
      setServerError(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  return (
    <AuthShell title="تنظیم رمز عبور جدید" description="رمز عبور جدید خود را وارد کنید.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="password">رمز عبور جدید</Label>
          <Input id="password" type="password" placeholder="حداقل ۸ کاراکتر" {...register("password")} />
          {errors.password && <p className="mt-1 text-xs text-(--color-danger)">{errors.password.message}</p>}
        </div>
        {!token && <p className="rounded-lg bg-(--color-warning-soft) px-3 py-2 text-xs text-(--color-warning)">لینک بازیابی نامعتبر است.</p>}
        {serverError && <p className="rounded-lg bg-(--color-danger-soft) px-3 py-2 text-xs text-(--color-danger)">{serverError}</p>}
        <Button type="submit" className="w-full" loading={isSubmitting} disabled={!token}>
          تغییر رمز عبور
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
