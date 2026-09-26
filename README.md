# SAMURAI

سامورایی یک پلتفرم SaaS فارسی و RTL برای مدیریت Workspace، پروژه، وظیفه، تیم، جلسه، گزارش و دستیار هوشمند است.

## Stack

- Next.js 16 / React 19 / TypeScript
- PostgreSQL + Drizzle ORM
- Tailwind CSS v4
- TanStack Query
- dnd-kit برای Kanban
- Recharts برای گزارش‌ها
- OpenAI SDK برای Samurai AI (اختیاری)

## اجرای محلی

```bash
cp .env.example .env.local
npm install
npm run db:push
npm run dev
```

حداقل متغیرهای لازم:

- `DATABASE_URL`
- `AUTH_SECRET`
- `OPENAI_API_KEY` فقط برای قابلیت‌های AI لازم است.
- برای بازیابی رمز عبور در Production: `APP_URL`، `RESEND_API_KEY` و `EMAIL_FROM` لازم‌اند. `EMAIL_FROM` باید از sender/domain تأییدشده در سرویس ایمیل باشد.

## کنترل کیفیت

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## شاخه‌ها

- `main`: نسخه پایدار
- `develop`: توسعه و اصلاحات قبل از Merge


## ایمیل بازیابی رمز عبور

سامورایی برای ارسال ایمیل بازیابی رمز عبور از Resend REST API استفاده می‌کند. در development، اگر سرویس ایمیل تنظیم نشده باشد، مسیر reset می‌تواند در پاسخ API نمایش داده شود؛ در Production لینک reset هرگز در پاسخ API برگردانده نمی‌شود و اگر ارسال ایمیل موفق نباشد token ساخته‌شده باطل می‌شود.
