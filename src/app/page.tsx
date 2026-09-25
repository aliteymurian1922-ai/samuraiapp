import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SamuraiLogo, SamuraiMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Kanban, Users, LineChart, ShieldCheck, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: Kanban, title: "پروژه و وظایف", desc: "کانبان روان، زیروظیفه، وابستگی و تقویم شمسی در یک محیط ساده." },
  { icon: Users, title: "تیم و بار کاری", desc: "بار کاری هر عضو را ببینید و پیش از فرسودگی، وظایف را متعادل کنید." },
  { icon: BrainCircuit, title: "سامورایی AI", desc: "دستیار هوشمندی که به داده واقعی تیم شما دسترسی دارد، نه حدس و گمان." },
  { icon: LineChart, title: "گزارش مدیریتی", desc: "پاسخ به «چه اتفاقی افتاد، چرا، و حالا چه باید کرد» در چند ثانیه." },
  { icon: ShieldCheck, title: "امنیت و نقش‌ها", desc: "کنترل دسترسی دقیق برای مالک، مدیر، عضو و بازدیدکننده." },
  { icon: Zap, title: "سریع و ساده", desc: "طراحی مینیمال Neumorphism که هرگز کاربر را گیج نمی‌کند." },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/app/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden bg-(--color-bg)">
      <div className="pointer-events-none absolute -top-40 right-[-10rem] h-96 w-96 rounded-full bg-indigo-200/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-10rem] left-[-10rem] h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <SamuraiLogo iconSize={34} />
        <nav className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">ورود</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">شروع رایگان</Button>
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-4xl px-6 pb-16 pt-10 text-center sm:pt-16">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-(--color-border) bg-white px-4 py-1.5 text-xs font-medium text-(--color-muted)">
          <SamuraiMark size={16} />
          مدیریت پروژه، تیم و تصمیم‌گیری هوشمند
        </div>
        <h1 className="text-3xl font-extrabold leading-[1.3] text-(--color-text) sm:text-5xl sm:leading-[1.25]">
          همه‌چیز برای مدیریت تیم و پروژه،
          <br />
          در یک محیط ساده و هوشمند.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm text-(--color-muted) sm:text-base">
          سامورایی به شما کمک می‌کند دقیقاً بفهمید تیمتان چه وضعیتی دارد و الان باید چه کاری انجام دهید —
          با کانبان روان، گزارش مدیریتی واقعی و دستیار هوشمند Samurai AI.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register">
            <Button size="lg">ساخت Workspace رایگان</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="secondary">ورود به حساب</Button>
          </Link>
        </div>
        <p className="mt-4 text-xs text-(--color-muted)">هوشمندتر کار کن، بزرگ‌تر فکر کن.</p>
      </section>

      <section className="relative mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="surface-card animate-fade-in p-5">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-(--color-primary-soft) text-(--color-primary)">
              <f.icon className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-(--color-text)">{f.title}</h3>
            <p className="mt-1.5 text-xs leading-6 text-(--color-muted)">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
