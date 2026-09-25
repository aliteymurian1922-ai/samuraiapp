"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SamuraiLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { Check, Briefcase, Megaphone, ShoppingBag, Building2, Rocket, MoreHorizontal } from "lucide-react";

const TEAM_TYPES = [
  { value: "software", label: "توسعه نرم‌افزار", icon: Briefcase },
  { value: "marketing", label: "بازاریابی", icon: Megaphone },
  { value: "sales", label: "فروش", icon: ShoppingBag },
  { value: "agency", label: "آژانس", icon: Building2 },
  { value: "startup", label: "استارتاپ", icon: Rocket },
  { value: "other", label: "سایر", icon: MoreHorizontal },
] as const;

const MEMBER_COUNTS = ["1-5", "6-15", "16-50", "50+"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [teamType, setTeamType] = useState<(typeof TEAM_TYPES)[number]["value"]>("software");
  const [memberCount, setMemberCount] = useState<(typeof MEMBER_COUNTS)[number]>("1-5");
  const [firstProjectName, setFirstProjectName] = useState("");

  async function finish() {
    setSubmitting(true);
    try {
      await api.post("/api/workspaces", { name, teamType, memberCount, firstProjectName: firstProjectName || undefined });
      toast.success("Workspace شما ساخته شد!");
      router.push("/app/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--color-bg) px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <SamuraiLogo iconSize={38} />
        </div>

        <div className="surface-raised animate-fade-in p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors", s <= step ? "bg-(--color-primary)" : "bg-slate-100")} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-(--color-text)">Workspace خود را نام‌گذاری کنید</h2>
                <p className="mt-1 text-xs text-(--color-muted)">این نام برای تیم شما در سامورایی نمایش داده می‌شود.</p>
              </div>
              <div>
                <Label htmlFor="ws-name">نام Workspace</Label>
                <Input id="ws-name" placeholder="مثلاً تیم محصول آسمان" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <Button className="w-full" disabled={name.trim().length < 2} onClick={() => setStep(2)}>
                ادامه
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-(--color-text)">تیم شما چه نوعی است؟</h2>
                <p className="mt-1 text-xs text-(--color-muted)">برای شخصی‌سازی تجربه سامورایی به شما کمک می‌کند.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TEAM_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTeamType(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition",
                      teamType === t.value ? "border-(--color-primary) bg-(--color-primary-soft) text-(--color-primary)" : "border-(--color-border) text-(--color-muted) hover:bg-slate-50",
                    )}
                  >
                    <t.icon className="size-5" />
                    {t.label}
                  </button>
                ))}
              </div>
              <div>
                <Label>تعداد اعضای تیم</Label>
                <div className="flex gap-2">
                  {MEMBER_COUNTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setMemberCount(c)}
                      className={cn(
                        "flex-1 rounded-xl border py-2 text-xs font-medium transition",
                        memberCount === c ? "border-(--color-primary) bg-(--color-primary-soft) text-(--color-primary)" : "border-(--color-border) text-(--color-muted) hover:bg-slate-50",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
                  بازگشت
                </Button>
                <Button className="flex-1" onClick={() => setStep(3)}>
                  ادامه
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-(--color-text)">اولین پروژه خود را بسازید</h2>
                <p className="mt-1 text-xs text-(--color-muted)">می‌توانید این مرحله را رد کنید و بعداً پروژه بسازید.</p>
              </div>
              <div>
                <Label htmlFor="project-name">نام پروژه (اختیاری)</Label>
                <Input id="project-name" placeholder="مثلاً طراحی وب‌سایت" value={firstProjectName} onChange={(e) => setFirstProjectName(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
                  بازگشت
                </Button>
                <Button className="flex-1" loading={submitting} onClick={finish}>
                  <Check className="size-4" />
                  تکمیل و ورود به سامورایی
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
