"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";
import { getUser, clearAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        triggerRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-xl bg-secondary/50 animate-pulse" />
    );
  }

  const user = getUser();
  if (!user) {
    return null;
  }

  // Avatar initials
  const getInitials = () => {
    if (user.full_name) {
      const names = user.full_name.trim().split(/\s+/);
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  // Avatar color based on role
  const getAvatarColor = () => {
    switch (user.role) {
      case "admin":
        return "bg-destructive text-destructive-foreground";
      case "pro_user":
        return "bg-primary text-primary-foreground";
      case "premium_user":
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Role display name
  const getRoleDisplayName = () => {
    switch (user.role) {
      case "admin":
        return "ADMIN";
      case "pro_user":
        return "PRO";
      case "premium_user":
        return "PREMIUM";
      default:
        return "FREE";
    }
  };

  const handleLogout = () => {
    clearAuth();
    setIsOpen(false);
    router.push("/login");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-200",
          "hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2",
          "active:scale-[0.98]",
          isOpen && "bg-secondary"
        )}
        aria-label="Kullanıcı menüsü"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div
          className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold font-display",
            "transition-all duration-200",
            "hover:scale-105 active:scale-95",
            getAvatarColor(),
            isOpen && "ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-background"
          )}
        >
          {getInitials()}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute right-0 mt-2 w-64 rounded-2xl border border-border glass-surface shadow-xl",
            "z-50 overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200",
            "md:w-64 w-[calc(100vw-2rem)] max-w-[280px]"
          )}
          role="menu"
        >
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold font-display",
                  getAvatarColor()
                )}
              >
                {getInitials()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate" title={user.full_name || user.email}>
                  {user.full_name || user.email}
                </p>
                <p className="text-xs text-muted-foreground truncate" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>
            <div className="mt-2">
              <Badge
                variant={
                  user.role === "admin"
                    ? "destructive"
                    : user.role === "pro_user"
                      ? "default"
                      : "secondary"
                }
                className="text-[9px]"
              >
                {getRoleDisplayName()}
              </Badge>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <Link
              href="/dashboard/settings"
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-2 text-sm text-foreground",
                "hover:bg-secondary transition-colors duration-150 cursor-pointer",
                "active:bg-secondary/80"
              )}
              role="menuitem"
            >
              <Settings className="h-4 w-4 text-muted-foreground transition-colors duration-150 group-hover:text-foreground" />
              <span>Hesap ve Ayarlar</span>
            </Link>
          </div>

          {/* Separator */}
          <div className="border-t border-border" />

          {/* Logout */}
          <div className="py-1">
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground",
                "hover:bg-destructive/10 hover:text-destructive transition-colors duration-150 cursor-pointer",
                "active:bg-destructive/20"
              )}
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              <span>Çıkış</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
