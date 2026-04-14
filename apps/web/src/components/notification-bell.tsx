"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, Trash2, Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { api, NotificationRecord } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

function formatRelativeTime(date: string | Date) {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return "az önce";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} dk önce`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} saat önce`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} gün önce`;
  
  return then.toLocaleDateString("tr-TR");
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = async () => {
    const token = getToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const data = await api.notifications.list(token);
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every 2 minutes
    const interval = setInterval(fetchNotifications, 120000);
    return () => clearInterval(interval);
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

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: number) => {
    const token = getToken();
    if (!token) return;

    try {
      await api.notifications.markAsRead(token, id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleDelete = async (id: number) => {
    const token = getToken();
    if (!token) return;

    try {
      await api.notifications.delete(token, id);
      setNotifications((prev) => {
        const remaining = prev.filter((n) => n.id !== id);
        setUnreadCount(remaining.filter((n) => !n.is_read).length);
        return remaining;
      });
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-positive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Info className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-xl transition-all duration-200",
          "hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          isOpen && "bg-secondary"
        )}
        aria-label="Bildirimler"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 rounded-2xl border border-border bg-card shadow-xl overflow-hidden z-50",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200",
            "fixed md:absolute md:w-80 w-[calc(100vw-2rem)] max-w-[340px]"
          )}
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
            <h3 className="text-sm font-semibold">Bildirimler</h3>
            {unreadCount > 0 && (
              <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {unreadCount} yeni
              </span>
            )}
          </div>

          <div className="max-h-[350px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Henüz bildiriminiz yok.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "p-4 hover:bg-secondary/40 transition-colors group relative",
                      !notif.is_read && "bg-primary/[0.02]"
                    )}
                  >
                    {!notif.is_read && (
                      <div className="absolute left-1 top-4 h-2 w-2 rounded-full bg-primary" />
                    )}
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0">{getTypeIcon(notif.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-[13px] font-semibold text-foreground truncate leading-tight">
                            {notif.title}
                          </h4>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground/60 uppercase font-medium">
                            {formatRelativeTime(notif.created_at)}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notif.is_read && (
                              <button
                                onClick={() => handleMarkAsRead(notif.id)}
                                className="p-1 px-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors text-[10px] font-medium flex items-center gap-1"
                                title="Okundu işaretle"
                              >
                                <Check className="h-3 w-3" />
                                Okundu
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(notif.id)}
                              className="p-1 px-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors text-[10px] font-medium flex items-center gap-1"
                              title="Sil"
                            >
                              <Trash2 className="h-3 w-3" />
                              Sil
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
