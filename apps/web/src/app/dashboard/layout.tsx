"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProModeToggle } from "@/components/pro-mode-toggle";
import { UserMenu } from "@/components/user-menu";
import { getUser } from "@/lib/auth";
import { AlertCircle, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

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
  const [user, setUser] = useState<any>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    if (!currentUser.profile_completed) {
      router.push("/onboarding");
      return;
    }
    setUser(currentUser);
    setReady(true);
  }, [router]);

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setIsResending(true);
    try {
      await api.auth.resendVerification(user.email);
      toast.success("Doğrulama maili gönderildi!", {
        description: "Lütfen e-posta kutunuzu (ve spam klasörünü) kontrol edin.",
        icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      });
    } catch (error: any) {
      toast.error("Mail gönderilemedi", {
        description: error.message || "Lütfen daha sonra tekrar deneyin.",
      });
    } finally {
      setIsResending(false);
    }
  };

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

      <main className="container mx-auto py-6 flex flex-col gap-6">
        {user && user.is_email_verified === false && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5" />
              <div>
                <AlertTitle>E-posta adresiniz doğrulanmadı</AlertTitle>
                <AlertDescription>
                  Hesabınızın güvenliği ve tüm özelliklere erişebilmek için lütfen e-postanızı doğrulayın.
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
              Yeniden Gönder
            </Button>
          </Alert>
        )}

        <div key={pathname} className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
