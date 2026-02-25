"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useProMode } from "./pro-mode-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { isPro } = useProMode();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn("h-8 w-8 rounded-sm", className)} />;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      disabled={isPro}
      className={cn(
        "relative h-8 w-8 rounded-sm border border-border bg-secondary/50 flex items-center justify-center",
        isPro
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-secondary hover:border-primary/20",
        "transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className
      )}
      aria-label={isDark ? "Acik temaya gec" : "Koyu temaya gec"}
      title={isPro ? "Pro Mod acikken tema degistirilemez" : undefined}
    >
      <svg
        className={cn(
          "h-3.5 w-3.5 transition-all duration-300",
          isDark ? "rotate-0 scale-100 text-primary" : "rotate-90 scale-0 text-primary"
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
        />
      </svg>

      <svg
        className={cn(
          "absolute h-3.5 w-3.5 transition-all duration-300",
          isDark ? "-rotate-90 scale-0 text-primary" : "rotate-0 scale-100 text-primary"
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
        />
      </svg>
    </button>
  );
}
