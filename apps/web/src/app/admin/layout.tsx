"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminGuard } from "@/components/admin-guard";
import { UserMenu } from "@/components/user-menu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
    <div className="min-h-screen bg-background">
      <div className="h-[2px] bg-destructive/60" />
      <nav className="border-b border-border/50 bg-background/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex h-12 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-sm bg-destructive/80 flex items-center justify-center">
                <span className="text-white font-display font-bold text-[9px]">FC</span>
              </div>
              <span className="font-display font-semibold text-sm tracking-tight">FinCalc</span>
              <Badge className="ml-1">ADMIN</Badge>
            </Link>

            <div className="h-4 w-px bg-border" />

            <div className="hidden md:flex items-center gap-1">
              {[
                { href: "/admin", label: "Genel" },
                { href: "/admin/bonds", label: "Tahviller" },
                { href: "/admin/users", label: "Kullanicilar" },
                { href: "/admin/logs", label: "Loglar" },
                { href: "/admin/metrics", label: "Metrikler" },
                { href: "/admin/import", label: "Veri Aktarimi" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-sm text-data-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-data-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Dashboard
            </Link>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="container mx-auto py-6">{children}</main>
    </div>
    </AdminGuard>
  );
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[9px] font-mono tracking-widest text-destructive uppercase ${className}`}
    >
      {children}
    </span>
  );
}
