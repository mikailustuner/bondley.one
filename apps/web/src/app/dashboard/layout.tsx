"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProModeToggle } from "@/components/pro-mode-toggle";
import { UserMenu } from "@/components/user-menu";
import { getUser } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Genel Bakis" },
  { href: "/dashboard/bonds", label: "Borclanma Araclari" },
  { href: "/dashboard/alerts", label: "Uyarilar" },
  { href: "/dashboard/analytics", label: "Analiz" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    if (!user.profile_completed) {
      router.push("/onboarding");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="data-strip" />
      <nav className="border-b border-border/50 glass-surface sticky top-0 z-50">
        <div className="container mx-auto flex h-12 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Bondley Logo"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
                priority
              />
              <span className="font-display font-semibold text-sm tracking-tight">Bondley</span>
            </Link>

            <div className="h-4 w-px bg-border" />

            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-sm text-data-sm transition-colors ${isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-label text-muted-foreground mr-1">
              <span className="h-1.5 w-1.5 rounded-full bg-positive live-indicator" />
              CANLI
            </div>
            <ProModeToggle />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="container mx-auto py-6">
        <div key={pathname} className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
