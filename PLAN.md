# PLAN.md — سامورایی (SAMURAI)

## 0. وضعیت اولیه Repository
پروژه یک Next.js 16 (App Router) + TypeScript + Tailwind v4 + Drizzle ORM + PostgreSQL starter خالی بود
(فقط health-check و یک صفحه‌ی نمونه). هیچ Auth، Schema یا UI واقعی وجود نداشت.

## 1. تصمیمات معماری کلیدی

| حوزه | تصمیم | دلیل |
|---|---|---|
| Auth | Custom session-based auth (cookie httpOnly + جدول `sessions` در DB) با `jose` برای امضای توکن و `bcryptjs` برای هش رمز | کنترل کامل روی مدل Multi-tenant/Membership که با Auth.js پیچیده‌تر می‌شد؛ Production-ready و ساده برای Vercel (Edge-safe) |
| Multi-tenancy | `users` → `memberships` → `workspaces` با نقش‌ها (owner/admin/manager/member/viewer) + کوکی `sam_ws` برای Workspace فعال | مطابق بند ۱۱ الزامات |
| API Layer | Route Handlers در `src/app/api/**` برای همه CRUDها (typed + zod validated) + Server Actions محدود برای فرم‌های ساده | یکدست‌سازی Authorization و اعتبارسنجی سمت سرور |
| ORM | Drizzle ORM (از قبل نصب) | مطابق قالب پروژه |
| Data fetching | Server Components برای SSR اولیه + fetch سمت کلاینت با TanStack Query برای تعامل‌های پویا (Kanban, Chat) | Streaming + Performance |
| Drag & Drop | dnd-kit | سبک، Accessible |
| Charts | Recharts | Responsive و ساده |
| AI | لایه‌ی `AIProvider` abstraction (`src/ai`) با `OpenAIProvider` (OpenAI SDK) + Tool-calling روی داده واقعی DB، fallback در نبود `OPENAI_API_KEY` | بند ۲۹ تا ۹۸ |
| Calendar فارسی | `jalaali-js` برای تبدیل تاریخ میلادی↔جلالی | سبک‌ترین راه‌حل قابل اتکا |
| فرم‌ها | react-hook-form + zod resolver | Validation یکپارچه client/server |
| Toast | sonner | سبک و قابل شخصی‌سازی، RTL friendly |
| Command Palette | cmdk | استاندارد صنعت |
| فونت | Vazirmatn (next/font/google) | فونت فارسی مدرن |
| تست | Vitest برای Unit/Integration روی منطق حساس (permissions, risk engine, workload, validation) | با توجه به محدودیت زمان از Playwright/E2E کامل صرف‌نظر و روی منطق حیاتی تمرکز شد؛ در README مستند شده |
| Storage پیوست | انتزاع `AttachmentProvider` — نسخه‌ی فعلی لینک خارجی/متادیتا را در DB ذخیره می‌کند؛ اتصال S3/Vercel Blob در آینده با پیاده‌سازی provider جدید ممکن است | بدون Fake Integration (بند ۱۱۶) |

## 2. فازبندی پیاده‌سازی (مطابق بند ۱۰۲ اما فشرده‌شده برای این نشست کاری)

- **Phase 1 (اصلی):** Auth, Workspace, Onboarding, Dashboard, Projects (CRUD+Views), Tasks+Kanban+Subtasks+Dependencies+Comments+Tags, Team+Permissions, Calendar, Notifications, Search/Command Palette
- **Phase 2:** Time Tracking, Meetings+Action Items, Activity Feed, Audit Log, Reports (Project/Team/Management)
- **Phase 3:** Samurai AI (Assistant + Tools + Insights + Risk Engine + Daily Brief + Report Generator)
- **Phase 4 (مستند اما خارج scope این نشست):** Integrations واقعی (Google Calendar و ...), زمان‌بندی خودکار پیشرفته، PWA کامل — این‌ها به‌صورت «Coming soon» در UI مشخص شده‌اند، نه Fake.

## 3. مدل داده (خلاصه)
users, sessions, passwordResetTokens, workspaces, memberships, projects, projectMembers,
taskStatuses, tasks, taskDependencies, tags, taskTags, comments, attachments, timeEntries,
meetings, meetingParticipants, actionItems, notifications, activities, auditLogs,
aiConversations, aiMessages, aiInsights.

## 4. تعریف Done برای این نشست
Build واقعی، TypeScript بدون خطا، Lint تمیز، تست‌های واحد حیاتی سبز، `build_and_start` سالم،
همه‌ی CRUDهای اصلی متصل به دیتابیس واقعی، Auth/Authorization واقعی، RTL کامل، Responsive کامل،
AI architecture واقعی با Fallback امن، README و env.example کامل.
