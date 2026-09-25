import type { ReactNode } from "react";
import { SamuraiLogo } from "@/components/brand/logo";

export function AuthShell({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-(--color-bg) px-4 py-10">
      <div className="pointer-events-none absolute -top-32 right-1/2 h-72 w-72 translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-6rem] left-[-4rem] h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <SamuraiLogo iconSize={40} />
        </div>
        <div className="surface-raised animate-fade-in p-6 sm:p-8">
          <h1 className="text-lg font-bold text-(--color-text)">{title}</h1>
          <p className="mt-1 text-sm text-(--color-muted)">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-(--color-muted)">{footer}</div>}
      </div>
    </main>
  );
}
