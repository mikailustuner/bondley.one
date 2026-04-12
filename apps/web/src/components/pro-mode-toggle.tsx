"use client";

import { useProMode } from "./pro-mode-provider";
import { cn } from "@/lib/utils";

export function ProModeToggle({ className }: { className?: string }) {
    const { isPro, toggleProMode } = useProMode();

    return (
        <button
            onClick={toggleProMode}
            className={cn(
                "relative h-8 px-2 rounded-sm border flex items-center justify-center font-mono text-xs font-bold transition-all duration-200",
                isPro
                    ? "border-primary text-primary bg-primary/10 shadow-[0_0_10px_rgba(132,204,22,0.2)]"
                    : "border-border text-muted-foreground bg-secondary/50 hover:bg-secondary hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                className
            )}
            aria-label={isPro ? "Pro Modu Kapat" : "Pro Moda Gec"}
        >
            <span className="mr-1 opacity-70">&gt;_</span>
            PRO
        </button>
    );
}
