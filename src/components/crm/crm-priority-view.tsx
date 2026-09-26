"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatJalaliDate } from "@/lib/date";

type PriorityBand = "urgent" | "high" | "normal" | "low" | "done";

type PriorityItem = {
  kind: "lead" | "deal";
  id: string;
  title: string;
  subtitle: string;
  value: number;
  score: number;
  priorityScore: number;
  priorityBand: PriorityBand;
  reasons: string[];
  recommendedAction: string;
  href: string;
  dueAt: string | null;
};

type PriorityQueue = {
  generatedAt: string;
  summary: {
    total: number;
    urgent: number;
    high: number;
    leads: number;
    deals: number;
  };
  items: PriorityItem[];
};

const numberFa = new Intl.NumberFormat("fa-IR");
const moneyFa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

const priorityLabel: Record<PriorityBand, string> = {
  urgent: "فوری",
  high: "بالا",
  normal: "عادی",
  low: "کم",
  done: "انجام‌شده",
};

const priorityClass: Record<PriorityBand, string> = {
  urgent: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  normal: "border-sky-200 bg-sky-50 text-sky-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function CrmPriorityView() {
  const query = useQuery({
    queryKey: ["crm", "priority"],
    queryFn: () => api.get<PriorityQueue>("/api/crm/priority"),
    refetchInterval: 60_000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20" />)}
        </div>
        {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32" />)}
      </div>
    );
  }

  const data = query.data;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="صف اقدام خالی است"
        description="فعلاً سرنخ یا فرصت فروشی که نیاز به توجه فوری داشته باشد وجود ندارد."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="اقدام‌های مهم" value={data.summary.total} />
        <SummaryCard label="فوری" value={data.summary.urgent} />
        <SummaryCard label="سرنخ‌ها" value={data.summary.leads} />
        <SummaryCard label="فرصت‌ها" value={data.summary.deals} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-(--color-border) px-4 py-3">
          <h2 className="text-sm font-extrabold text-(--color-text)">امروز روی چه چیزهایی کار کنم؟</h2>
          <p className="mt-1 text-[11px] text-(--color-muted)">
            ترتیب بر اساس فوریت، ارزش و وضعیت واقعی پیگیری‌ها محاسبه شده است.
          </p>
        </div>

        <div className="divide-y divide-(--color-border)">
          {data.items.map((item, index) => (
            <div key={`${item.kind}-${item.id}`} className="grid gap-3 p-4 lg:grid-cols-[42px_1fr_auto] lg:items-start">
              <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-extrabold text-slate-500">
                {numberFa.format(index + 1)}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={item.href} className="truncate text-sm font-extrabold text-(--color-text) hover:text-(--color-primary)">
                    {item.title}
                  </Link>
                  <Badge className={priorityClass[item.priorityBand]}>
                    {priorityLabel[item.priorityBand]}
                  </Badge>
                  <Badge variant="secondary">{item.kind === "lead" ? "سرنخ" : "فرصت فروش"}</Badge>
                </div>

                <p className="mt-1 text-[11px] text-(--color-muted)">{item.subtitle}</p>

                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-bold text-(--color-text)">{item.recommendedAction}</p>
                  {item.reasons.length > 0 && (
                    <p className="mt-1.5 text-[11px] leading-5 text-(--color-muted)">
                      {item.reasons.join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-row items-center justify-between gap-4 lg:min-w-[170px] lg:flex-col lg:items-end">
                <div className="text-left lg:text-right">
                  <p className="text-[10px] text-slate-400">امتیاز اولویت</p>
                  <p className="text-lg font-extrabold text-(--color-primary)">{numberFa.format(item.priorityScore)}</p>
                </div>
                <div className="text-left lg:text-right">
                  <p className="text-xs font-bold text-(--color-text)">{moneyFa.format(item.value)} تومان</p>
                  {item.dueAt && <p className="mt-1 text-[10px] text-slate-400">موعد: {formatJalaliDate(item.dueAt)}</p>}
                </div>
                <Link
                  href={item.href}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-(--color-border) bg-white px-3 text-[11px] font-semibold text-(--color-primary)"
                >
                  باز کردن پرونده
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium text-(--color-muted)">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-(--color-text)">{numberFa.format(value)}</p>
    </Card>
  );
}
