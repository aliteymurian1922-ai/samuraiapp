import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  CalendarDays,
  Users,
  Video,
  BarChart3,
  Sparkles,
  Bell,
  Settings,
} from "lucide-react";
import { CrmIcon } from "@/components/icons/crm-icon";

export const MAIN_NAV = [
  { href: "/app/dashboard", label: "داشبورد", icon: LayoutDashboard, shortcut: "D" },
  { href: "/app/crm", label: "فروش و مشتریان", icon: CrmIcon, shortcut: "C" },
  { href: "/app/projects", label: "پروژه‌ها", icon: FolderKanban, shortcut: "P" },
  { href: "/app/tasks", label: "وظایف", icon: ListChecks, shortcut: "T" },
  { href: "/app/calendar", label: "تقویم", icon: CalendarDays },
  { href: "/app/team", label: "تیم", icon: Users },
  { href: "/app/meetings", label: "جلسات", icon: Video },
  { href: "/app/reports", label: "گزارش‌ها", icon: BarChart3 },
  { href: "/app/ai", label: "سامورایی AI", icon: Sparkles },
] as const;

export const SECONDARY_NAV = [
  { href: "/app/notifications", label: "اعلان‌ها", icon: Bell },
  { href: "/app/settings", label: "تنظیمات", icon: Settings },
] as const;

export const MOBILE_NAV = [
  { href: "/app/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/app/tasks", label: "وظایف", icon: ListChecks },
  { href: "/app/projects", label: "پروژه‌ها", icon: FolderKanban },
  { href: "/app/ai", label: "AI", icon: Sparkles },
] as const;
