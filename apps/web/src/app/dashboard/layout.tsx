"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";
import { getUser } from "@/lib/auth";
import {
  LayoutDashboard,
  List,
  Bell,
  BarChart3,
  Settings,
  Menu,
  X,
  Mail,
  Loader2,
  CheckCircle2,
  Star,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { tr } from "@/locales/tr";
import { APP_VERSION } from "@/lib/constants";

const NAV_SECTIONS = [
  {
    title: null,
    items: [
      { href: "/dashboard", label: tr.dashboard.nav.overview, icon: LayoutDashboard },
      { href: "/dashboard/bonds", label: tr.dashboard.nav.bonds, icon: List },
      { href: "/dashboard/favorites", label: tr.dashboard.nav.favorites, icon: Star },
      { href: "/dashboard/alerts", label: tr.dashboard.nav.alerts, icon: Bell },
      { href: "/dashboard/analytics", label: tr.dashboard.nav.analytics, icon: BarChart3 },
    ],
  },
  {
    title: tr.dashboard.nav.account,
    items: [
      { href: "/dashboard/settings", label: tr.dashboard.nav.settings, icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isResending, setIsResending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    
    // Set initial local user
    setUser(currentUser);
    setReady(true);

    // Fetch fresh user data from API to sync states (e.g. email verification)
    const syncUser = async () => {
      try {
        const { getToken, updateLocalUser } = await import("@/lib/auth");
        const token = getToken();
        if (token) {
          const freshUser = await api.auth.me(token);
          setUser(freshUser);
          updateLocalUser(freshUser);
        }
      } catch (error) {
        console.error("Failed to sync user data:", error);
      }
    };

    if (currentUser.profile_completed) {
      syncUser();
    } else {
      router.push("/onboarding");
    }
  }, [router]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setIsResending(true);
    try {
      await api.auth.resendVerification(user.email);
      toast.success(tr.dashboard.verification.toastSuccess, {
        description: tr.dashboard.verification.toastSuccessDesc,
        icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      });
    } catch (error: any) {
      toast.error(tr.dashboard.verification.toastError, {
        description: error.message || tr.dashboard.verification.toastErrorDesc,
      });
    } finally {
      setIsResending(false);
    }
  };

  if (!ready) return null;

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <span className="bondley-app-logo-tile">
            <Image src="/logo-mark.svg" alt="" width={34} height={34} priority />
          </span>
        </Link>
        <span className="flex flex-col gap-1">
          <Link href="/" className="font-mono-data text-[15px] font-semibold tracking-[-0.07em] text-foreground hover:text-primary">{tr.common.brand}</Link>
          <a href="https://aurict.com" target="_blank" rel="noreferrer" className="font-mono-data text-[7px] uppercase tracking-[.16em] text-primary hover:text-foreground">by Aurict ↗</a>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-6 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.title && (
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-item ${isActive(item.href) ? "sidebar-item-active" : ""}`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="space-y-2 border-t border-border/30 px-3 pb-4 pt-2">
        <div className="flex items-center justify-between px-3 py-1">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-positive live-indicator" />
            <span className="text-[11px] font-medium text-muted-foreground">{tr.dashboard.sidebar.liveData}</span>
          </div>
          <span className="font-mono-data text-[10px] text-muted-foreground/40">v{APP_VERSION}</span>
        </div>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
          <UserMenu />
        </div>
      </div>
    </>
  );

  return (
    <div className="workspace-grid flex min-h-screen bg-background">
      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="sidebar fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col lg:flex">
        {sidebarContent}
      </aside>

      {/* ═══ Mobile Overlay ═══ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-50 flex w-[280px] transform flex-col transition-transform duration-300 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
          aria-label={tr.dashboard.sidebar.closeMenu}
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* ═══ Main Content ═══ */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
        {/* Mobile top bar */}
        <div
          className="apple-navbar sticky top-0 z-30 lg:hidden"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-2 rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={tr.dashboard.sidebar.openMenu}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Image
              src="/logo-mark.svg"
              alt="Bondley"
              width={22}
              height={22}
              className="h-[22px] w-[22px] object-contain"
            />
            <span className="font-mono-data text-[14px] font-semibold tracking-[-.06em] text-foreground">{tr.common.brand}</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>
        </div>

        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pt-9 xl:px-12">
          {user && user.is_email_verified === false && (
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/15 text-destructive flex items-center justify-between rounded-2xl mb-6">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5" />
                <div>
                  <AlertTitle>{tr.dashboard.verification.alertTitle}</AlertTitle>
                  <AlertDescription>
                    {tr.dashboard.verification.alertDescription}
                  </AlertDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 bg-background text-foreground"
                onClick={handleResendVerification}
                disabled={isResending}
              >
                {isResending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {tr.dashboard.verification.resendButton}
              </Button>
            </Alert>
          )}

          <div key={pathname} className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
