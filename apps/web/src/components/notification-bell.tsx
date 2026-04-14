"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";
import { Bell, Check, Trash2, Info, AlertTriangle, CheckCircle2, XCircle, MoreVertical } from "lucide-react";
import { api, NotificationRecord } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

/* --- Native time formatting --- */
function formatDistanceToNowNative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "az önce";
  if (diffMin < 60) return `${diffMin} dakika önce`;
  if (diffHour < 24) return `${diffHour} saat önce`;
  if (diffDay < 30) return `${diffDay} gün önce`;
  return date.toLocaleDateString("tr-TR");
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = getToken();
      if (!token) return;
      
      const response = await api.notifications.list(token);
      setNotifications(response);
      setUnreadCount(response.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Check every minute
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

  const handleMarkAsRead = async (id: number) => {
    try {
      const token = getToken();
      if (!token) return;
      
      await api.notifications.markAsRead(token, id);
      setNotifications((prev) => 
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = getToken();
      if (!token) return;
      
      await api.notifications.markAllAsRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = getToken();
      if (!token) return;
      
      await api.notifications.delete(token, id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prevCount) => {
        const deletedWasUnread = notifications.find(n => n.id === id && !n.is_read);
        if (deletedWasUnread) return Math.max(0, prevCount - 1);
        return prevCount;
      });
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const getIcon = (type: string, isRead: boolean) => {
    const isUnread = !isRead;
    switch (type) {
      case "info":
        return <Info className={cn("h-4 w-4", isUnread ? "text-blue-500" : "text-muted-foreground")} />;
      case "success":
        return <CheckCircle2 className={cn("h-4 w-4", isUnread ? "text-green-500" : "text-muted-foreground")} />;
      case "warning":
        return <AlertTriangle className={cn("h-4 w-4", isUnread ? "text-yellow-500" : "text-muted-foreground")} />;
      case "error":
        return <XCircle className={cn("h-4 w-4", isUnread ? "text-red-500" : "text-muted-foreground")} />;
      default:
        return <Info className={cn("h-4 w-4", isUnread ? "text-blue-500" : "text-muted-foreground")} />;
    }
  };

  if (!mounted) {
    return <div className="h-9 w-9 rounded-xl animate-pulse bg-secondary/50" />;
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-xl transition-all duration-200",
          "hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          "active:scale-95",
          isOpen && "bg-secondary"
        )}
        aria-label="Bildirimler"
      >
        <Bell className={cn("h-5 w-5 text-muted-foreground", unreadCount > 0 && "text-foreground")} />
        
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-background pointer-events-none" />
        )}
      </button>

      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-background/60 backdrop-blur-md transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={dropdownRef}
            className={cn(
              "relative z-10 w-full max-w-[340px] rounded-[2rem] border border-border/50 bg-card shadow-2xl flex flex-col overflow-hidden",
              "animate-in fade-in-0 zoom-in-95 duration-200"
            )}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
              <h3 className="text-sm font-semibold">Bildirimler</h3>
              {unreadCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAllAsRead();
                  }}
                  className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Tümü okundu
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
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
                        <div className="mt-0.5 shrink-0">{getIcon(notif.type, notif.is_read)}</div>
                        <div className="flex-1 min-w-0 pr-6">
                          <p className={cn(
                            "text-[13px] leading-snug",
                            !notif.is_read ? "text-foreground font-medium" : "text-foreground/90"
                          )}>
                            {notif.message}
                          </p>
                          <span className="text-[11px] text-muted-foreground mt-1.5 block shrink-0 font-medium">
                            {formatDistanceToNowNative(notif.created_at)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Action buttons (appear on hover) */}
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                        {!notif.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notif.id);
                            }}
                            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary"
                            title="Okundu olarak işaretle"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notif.id);
                          }}
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive"
                          title="Bildirimi sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
