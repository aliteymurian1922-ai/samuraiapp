"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { toPersianDigits } from "@/lib/utils";

export function CompletionTrendChart({ data }: { data: { day: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="flex h-48 items-center justify-center text-xs text-(--color-muted)">هنوز داده‌ای برای نمایش روند وجود ندارد.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
        <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={24} />
        <Tooltip formatter={(v) => toPersianDigits(Number(v))} labelFormatter={(v) => v} />
        <Area type="monotone" dataKey="count" stroke="#4f46e5" fill="url(#colorCompleted)" strokeWidth={2} name="تکمیل‌شده" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function WorkloadChart({ data }: { data: { name: string; assignedHours: number }[] }) {
  if (data.length === 0) {
    return <p className="flex h-48 items-center justify-center text-xs text-(--color-muted)">عضوی برای نمایش بار کاری وجود ندارد.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0f4" />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
        <Tooltip formatter={(v) => `${toPersianDigits(Number(v))} ساعت`} />
        <Bar dataKey="assignedHours" fill="#7c3aed" radius={[0, 6, 6, 0]} name="ساعت کاری" />
      </BarChart>
    </ResponsiveContainer>
  );
}
