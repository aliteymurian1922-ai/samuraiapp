import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "سامورایی | SAMURAI — مدیریت هوشمند پروژه و تیم",
  description:
    "سامورایی یک پلتفرم مدرن برای مدیریت پروژه، تیم، وظایف و تصمیم‌گیری مبتنی بر هوش مصنوعی است. هوشمندتر کار کن، بزرگ‌تر فکر کن.",
  icons: { icon: "/favicon.png" },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="bg-(--color-bg) text-(--color-text) antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
