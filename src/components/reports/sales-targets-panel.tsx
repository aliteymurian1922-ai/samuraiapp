"use client";

import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { SalesForecastReport } from "@/server/sales-forecast";

type TargetsResponse = {
  targets: {
    month: string;
    workspaceTarget: number;
    members: {
      userId: string;
      name: string;
      role: string;
      targetValue: number;
    }[];
  };
  canManage: boolean;
};

const money = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("fa-IR");

function errorMessage(error: unknown) {
  return error instanceof ClientApiError ? error.message : "ذخیره هدف فروش انجام نشد.";
}

export function SalesTargetsPanel({ report }: { report: SalesForecastReport }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const targetQuery = useQuery({
    queryKey: ["sales-targets", report.targetMonth],
    queryFn: () =>
      api.get<TargetsResponse>(
        `/api/reports/sales/targets?month=${encodeURIComponent(report.targetMonth)}`,
      ),
  });

  const target = Number(report.summary.targetValue ?? 0);
  const attained = Number(report.summary.attainmentPercent ?? 0);
  const forecastAttained = Number(report.summary.forecastAttainmentPercent ?? 0);
  const gap = Number(report.summary.gapToTarget ?? 0);
  const forecastGap = Number(report.summary.forecastGapToTarget ?? 0);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetQuery.data) return;

    const form = new FormData(event.currentTarget);
    const workspaceTarget = Number(form.get("workspaceTarget") || 0);

    const memberTargets = targetQuery.data.targets.members.map((member) => ({
      userId: member.userId,
      targetValue: Number(form.get(`member:${member.userId}`) || 0),
    }));

    try {
      setSaving(true);
      await api.put("/api/reports/sales/targets", {
        month: report.targetMonth,
        workspaceTarget,
        memberTargets,
      });

      await Promise.all([
        client.invalidateQueries({ queryKey: ["sales-targets", report.targetMonth] }),
        client.invalidateQueries({ queryKey: ["report-sales-forecast"] }),
      ]);

      toast.success("اهداف فروش ماه ذخیره شد.");
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-(--color-text)">هدف فروش ماه</p>
              {target > 0 ? (
                <Badge variant={forecastAttained >= 100 ? "success" : forecastAttained >= 75 ? "warning" : "outline"}>
                  Forecast {number.format(forecastAttained)}٪ هدف
                </Badge>
              ) : (
                <Badge variant="warning">هدف تعیین نشده</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-(--color-muted)">
              فروش قطعی، Forecast و فاصله باقی‌مانده تا هدف در یک نمای واحد.
            </p>
          </div>

          {targetQuery.data?.canManage && (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              تنظیم اهداف
            </Button>
          )}
        </div>

        {target <= 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-(--color-border) bg-slate-50 p-4">
            <p className="text-xs font-semibold text-(--color-text)">
              برای این ماه هنوز هدف فروش ثبت نشده است.
            </p>
            <p className="mt-1 text-[11px] leading-5 text-(--color-muted)">
              با تعیین هدف تیم و اعضا، درصد تحقق و فاصله تا هدف به Forecast اضافه می‌شود.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <TargetMetric label="هدف تیم" value={target} />
              <TargetMetric label="فروش قطعی" value={Number(report.summary.wonThisMonth)} />
              <TargetMetric label="Forecast ماه" value={Number(report.summary.forecastThisMonth)} />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="font-semibold text-(--color-text)">تحقق قطعی هدف</span>
                <span className="text-(--color-muted)">{number.format(attained)}٪</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-(--color-primary)"
                  style={{ width: `${Math.min(100, attained)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-(--color-muted)">
                {gap > 0
                  ? `${money.format(gap)} تومان تا هدف قطعی باقی مانده است.`
                  : "هدف قطعی این ماه محقق شده است."}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="font-semibold text-(--color-text)">پوشش هدف با Forecast</span>
                <span className="text-(--color-muted)">{number.format(forecastAttained)}٪</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${forecastAttained >= 100 ? "bg-emerald-600" : "bg-(--color-warning)"}`}
                  style={{ width: `${Math.min(100, forecastAttained)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-(--color-muted)">
                {forecastGap > 0
                  ? `Forecast فعلی هنوز ${money.format(forecastGap)} تومان با هدف فاصله دارد.`
                  : `Forecast فعلی ${money.format(Math.abs(forecastGap))} تومان بالاتر از هدف است.`}
              </p>
            </div>

            {report.team.some((member) => Number(member.targetValue) > 0) && (
              <div className="border-t border-(--color-border) pt-4">
                <p className="mb-3 text-xs font-bold text-(--color-text)">تحقق هدف اعضای فروش</p>
                <div className="space-y-2">
                  {report.team
                    .filter((member) => member.ownerId && Number(member.targetValue) > 0)
                    .map((member) => (
                      <div key={member.ownerId} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-(--color-text)">{member.ownerName}</p>
                            <p className="mt-0.5 text-[10px] text-(--color-muted)">
                              {money.format(member.wonValueThisMonth)} از {money.format(member.targetValue)} تومان
                            </p>
                          </div>
                          <Badge variant={member.forecastAttainmentPercent >= 100 ? "success" : member.attainmentPercent >= 75 ? "warning" : "outline"}>
                            {number.format(member.attainmentPercent)}٪
                          </Badge>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full bg-(--color-primary)"
                            style={{ width: `${Math.min(100, member.attainmentPercent)}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[10px] text-(--color-muted)">
                          Forecast: {money.format(member.forecastValue)} تومان · {number.format(member.forecastAttainmentPercent)}٪ هدف
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="تنظیم اهداف فروش ماه"
          description="هدف کل تیم و سهمیه هر عضو برای همین ماه ذخیره می‌شود و ماه‌های قبلی دست‌نخورده می‌مانند."
        >
          {targetQuery.isLoading || !targetQuery.data ? (
            <Skeleton className="h-64" />
          ) : (
            <form onSubmit={save} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-(--color-text)">هدف کل تیم</span>
                <Input
                  name="workspaceTarget"
                  type="number"
                  min="0"
                  step="100000"
                  defaultValue={targetQuery.data.targets.workspaceTarget}
                />
                <span className="mt-1 block text-[10px] text-(--color-muted)">مبلغ به تومان</span>
              </label>

              <div>
                <p className="mb-2 text-xs font-bold text-(--color-text)">هدف اعضا</p>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {targetQuery.data.targets.members.map((member) => (
                    <label
                      key={member.userId}
                      className="grid grid-cols-[1fr_150px] items-center gap-3 rounded-xl border border-(--color-border) bg-slate-50 p-3"
                    >
                      <div>
                        <p className="text-xs font-semibold text-(--color-text)">{member.name}</p>
                        <p className="mt-0.5 text-[10px] text-(--color-muted)">{member.role}</p>
                      </div>
                      <Input
                        name={`member:${member.userId}`}
                        type="number"
                        min="0"
                        step="100000"
                        defaultValue={member.targetValue}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-(--color-border) pt-3">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  انصراف
                </Button>
                <Button type="submit" loading={saving}>
                  ذخیره اهداف
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TargetMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-base font-extrabold text-(--color-text)">{money.format(value)}</p>
      <p className="mt-0.5 text-[10px] text-(--color-muted)">{label} · تومان</p>
    </div>
  );
}
