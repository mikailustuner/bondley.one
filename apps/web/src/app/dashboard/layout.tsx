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
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { tr } from "@/locales/tr";

const NAV_SECTIONS = [
  {
    title: null,
    items: [
      { href: "/dashboard", label: tr.dashboard.nav.overview, icon: LayoutDashboard },
      { href: "/dashboard/bonds", label: tr.dashboard.nav.bonds, icon: List },
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
        <Image
          src="/logo.png"
          alt="Bondley"
          width={26}
          height={26}
          className="h-[26px] w-[26px] object-contain"
          priority
        />
        <span className="font-semibold text-[16px] tracking-tight text-foreground">
          {tr.common.brand}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-6 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.title && (
              <div className="px-3 mb-2 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
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
      <div className="px-3 pb-4 pt-2 border-t border-border/30 space-y-2">
        <div className="flex items-center gap-2 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-positive live-indicator" />
          <span className="text-[11px] font-medium text-muted-foreground">{tr.dashboard.sidebar.liveData}</span>
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
    <div className="min-h-screen bg-background flex">
      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="sidebar hidden lg:flex flex-col w-[260px] shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* ═══ Mobile Overlay ═══ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-50 flex flex-col w-[280px] transform transition-transform duration-300 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "hsl(var(--card))" }}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground"
          aria-label={tr.dashboard.sidebar.closeMenu}
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden apple-navbar sticky top-0 z-30 flex items-center justify-between px-4 h-14">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-secondary/60 text-muted-foreground"
            aria-label={tr.dashboard.sidebar.openMenu}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Bondley"
              width={22}
              height={22}
              className="h-[22px] w-[22px] object-contain"
            />
            <span className="font-semibold text-[15px] text-foreground">{tr.common.brand}</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>

        <main className="flex-1 px-6 lg:px-10 py-8 max-w-[1200px] mx-auto w-full">
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
