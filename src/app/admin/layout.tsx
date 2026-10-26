import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/admin/ToastProvider";
import { cn } from "@/lib/cn";
import { inter, lora, notoSansDeva } from "../fonts";
import "../globals.css";

// Root layout for /admin (the public site has its own under [locale]).
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(
        "admin-root",
        lora.variable,
        inter.variable,
        notoSansDeva.variable,
      )}
    >
      <body className="min-h-dvh bg-ivory text-navy antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
