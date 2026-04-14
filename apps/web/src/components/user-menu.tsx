"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, LogOut, ChevronDown } from "lucide-react";
import { getUser, clearAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function UserMenu({ position = "top" }: { position?: "top" | "bottom" }) {
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
      <div className="h-9 w-9 rounded-full bg-secondary animate-pulse" />
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
        return "Admin";
      case "pro_user":
        return "Pro";
      case "premium_user":
        return "Premium";
      default:
        return "Free";
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
          "hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
          "active:scale-[0.98]",
          isOpen && "bg-secondary"
        )}
        aria-label="Kullanıcı menüsü"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
            "transition-all duration-200",
            getAvatarColor(),
            isOpen && "ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
          )}
        >
          {getInitials()}
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 w-64 rounded-xl border border-border bg-card shadow-lg",
            "z-50 overflow-hidden",
            position === "top" 
              ? "bottom-full mb-2 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200" 
              : "top-full mt-2 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200",
            "md:w-64 w-[calc(100vw-2rem)] max-w-[280px]"
          )}
          role="menu"
        >
          {/* User Info Section */}
          <div className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold",
                  getAvatarColor()
                )}
              >
                {getInitials()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-foreground truncate" title={user.full_name || user.email}>
                  {user.full_name || user.email}
                </p>
                <p className="text-[13px] text-muted-foreground truncate" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>
            <div className="mt-2.5">
              <Badge
                variant={
                  user.role === "admin"
                    ? "destructive"
                    : user.role === "pro_user"
                      ? "default"
                      : "secondary"
                }
                className="text-[10px]"
              >
                {getRoleDisplayName()}
              </Badge>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1.5">
            <Link
              href="/dashboard/settings"
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-[15px] text-foreground",
                "hover:bg-secondary transition-colors duration-150 cursor-pointer",
                "active:bg-secondary/80"
              )}
              role="menuitem"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Hesap ve Ayarlar</span>
            </Link>
          </div>

          {/* Separator */}
          <div className="border-t border-border" />

          {/* Logout */}
          <div className="py-1.5">
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-[15px] text-foreground",
                "hover:bg-destructive/8 hover:text-destructive transition-colors duration-150 cursor-pointer",
                "active:bg-destructive/12"
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
