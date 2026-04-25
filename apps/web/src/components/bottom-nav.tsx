"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, Star, Bell, Settings } from "lucide-react";
import { tr } from "@/locales/tr";

const NAV_ITEMS = [
  { href: "/dashboard",            label: tr.dashboard.nav.overview,   icon: LayoutDashboard },
  { href: "/dashboard/bonds",      label: tr.dashboard.nav.bonds,      icon: List },
  { href: "/dashboard/favorites",  label: tr.dashboard.nav.favorites,  icon: Star },
  { href: "/dashboard/alerts",     label: tr.dashboard.nav.alerts,     icon: Bell },
  { href: "/dashboard/settings",   label: tr.dashboard.nav.settings,   icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 apple-navbar border-t border-border/60 safe-bottom"
    >
      <div className="flex h-14">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon
                className="h-[22px] w-[22px]"
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
