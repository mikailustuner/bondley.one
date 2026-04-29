"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Info, ArrowRight, ChevronRight, Users } from "lucide-react";
import { tr } from "@/locales/tr";
import { cn } from "@/lib/utils";

const ABOUT_POPUP_KEY = "bondley_about_popup_seen";

export function AboutPopup() {
  const [visible, setVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const content = tr.landing.hakkimizda;

  useEffect(() => {
    const seen = localStorage.getItem(ABOUT_POPUP_KEY);
    if (!seen) {
      const timer = setTimeout(() => {
        setVisible(true);
      }, 2000);

      // Auto-collapse after 25 seconds
      const collapseTimer = setTimeout(() => {
        setIsExpanded(false);
      }, 25000);

      return () => {
        clearTimeout(timer);
        clearTimeout(collapseTimer);
      };
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(ABOUT_POPUP_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div 
      className={cn(
        "fixed z-[60] transition-all duration-700 ease-in-out",
        isExpanded 
          ? "bottom-6 right-6 w-[440px] max-w-[calc(100vw-48px)]" 
          : "top-1/2 -translate-y-1/2 right-0 w-[36px] h-[120px]"
      )}
    >
      {isExpanded ? (
        <div className="relative overflow-hidden rounded-[32px] border border-primary/20 bg-background/98 backdrop-blur-2xl shadow-2xl shadow-primary/10 animate-in fade-in zoom-in-95 duration-500">
          {/* Subtle glow background */}
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          
          <div className="p-7">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <Info className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight leading-none">
                    {content.title}
                  </h3>
                  <p className="text-[12px] text-primary font-medium mt-1 uppercase tracking-wider">Bondley Ekibi</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all"
                  title="Küçült"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button 
                  onClick={handleClose}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-5">
              <p className="text-[15px] text-foreground font-semibold leading-relaxed">
                {content.description}
              </p>
              
              <p className="text-[14px] text-muted-foreground leading-relaxed">
                {content.content1}
              </p>

              {/* Names Section */}
              <div className="relative p-5 rounded-2xl bg-primary/[0.03] border border-primary/10 group overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                   <Users className="w-8 h-8 text-primary" />
                </div>
                <p className="text-[14px] text-foreground leading-relaxed font-medium relative z-10">
                  {content.content2}
                </p>
              </div>
            </div>

            {/* Footer Action */}
            <div className="mt-8">
              <Link 
                href="/hakkimizda"
                onClick={handleClose}
                className="group flex items-center justify-center gap-2 w-full rounded-2xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-[0.98]"
              >
                Tüm Detayları Gör
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Collapsed State - Minimalist Vertical Tab */
        <button
          onClick={() => setIsExpanded(true)}
          className="group relative flex h-[120px] w-[36px] items-center justify-center rounded-l-xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:w-[42px] transition-all duration-300 animate-in slide-in-from-right-10 overflow-hidden"
        >
          <div className="rotate-180" style={{ writingMode: 'vertical-rl' }}>
            <span className="text-[12px] font-bold tracking-[0.2em] uppercase py-2">
              Hakkımızda
            </span>
          </div>
          
          {/* Subtle glow effect on hover */}
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}
    </div>
  );
}
