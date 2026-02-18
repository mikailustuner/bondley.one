import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="data-strip" />
      <nav className="border-b border-border/50 bg-background/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex h-12 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-sm bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-display font-bold text-[9px]">FC</span>
              </div>
              <span className="font-display font-semibold text-sm tracking-tight">FinCalc</span>
            </Link>

            <div className="h-4 w-px bg-border" />

            <div className="hidden md:flex items-center gap-1">
              {[
                { href: "/dashboard", label: "Genel Bakis", active: true },
                { href: "/dashboard/bonds", label: "Tahviller" },
                { href: "/dashboard/analytics", label: "Analiz" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-sm text-data-sm transition-colors ${
                    item.active
                      ? "text-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-label text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-positive live-indicator" />
              CANLI
            </div>
            <ThemeToggle />
            <div className="h-7 w-7 rounded-sm bg-secondary flex items-center justify-center border border-border">
              <span className="text-[10px] font-display font-medium text-muted-foreground">A</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto py-6">{children}</main>
    </div>
  );
}
