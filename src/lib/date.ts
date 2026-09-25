import * as jalaali from "jalaali-js";

const weekDaysFa = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const monthsFa = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export function toJalali(date: Date) {
  const j = jalaali.toJalaali(date);
  return j;
}

export function formatJalaliDate(date: Date | string | null | undefined, withWeekday = false) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const j = jalaali.toJalaali(d);
  const base = `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`;
  if (!withWeekday) return base;
  return `${weekDaysFa[d.getDay()]} ${j.jd} ${monthsFa[j.jm - 1]}`;
}

export function formatJalaliDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const time = d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  return `${formatJalaliDate(d)} - ${time}`;
}

export function relativeTimeFa(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "همین الان";
  if (diffMin < 60) return `${diffMin} دقیقه پیش`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ساعت پیش`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay} روز پیش`;
  const diffMonth = Math.round(diffDay / 30);
  return `${diffMonth} ماه پیش`;
}

export function isOverdue(dueDate: Date | string | null | undefined, completedAt?: Date | string | null) {
  if (!dueDate || completedAt) return false;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  return d.getTime() < Date.now();
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
export const JALALI_WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export function getJalaliMonthGrid(jy: number, jm: number) {
  const daysInMonth = jalaali.jalaaliMonthLength(jy, jm);
  const firstDayGregorian = jalaali.toGregorian(jy, jm, 1);
  const firstDate = new Date(firstDayGregorian.gy, firstDayGregorian.gm - 1, firstDayGregorian.gd);
  // JS getDay(): 0=Sunday..6=Saturday. Persian week starts Saturday.
  const offset = (firstDate.getDay() + 1) % 7;

  const days: { jd: number; date: Date }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const g = jalaali.toGregorian(jy, jm, d);
    days.push({ jd: d, date: new Date(g.gy, g.gm - 1, g.gd) });
  }

  const lastDayGregorian = jalaali.toGregorian(jy, jm, daysInMonth);
  const rangeStart = firstDate;
  const rangeEnd = new Date(lastDayGregorian.gy, lastDayGregorian.gm - 1, lastDayGregorian.gd, 23, 59, 59);

  return { daysInMonth, offset, days, rangeStart, rangeEnd };
}

export function shiftJalaliMonth(jy: number, jm: number, delta: number) {
  let y = jy;
  let m = jm + delta;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return { jy: y, jm: m };
}
