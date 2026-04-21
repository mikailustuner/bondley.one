"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { tr } from "@/locales/tr";

type CookiePreferences = {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
};

const COOKIE_CONSENT_KEY = "bondley_cookie_consent";

function getCookiePreferences(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveCookiePreferences(prefs: CookiePreferences) {
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const existing = getCookiePreferences();
    if (!existing) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
    };
    saveCookiePreferences(prefs);
    setVisible(false);
  };

  const handleAcceptEssential = () => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
    };
    saveCookiePreferences(prefs);
    setVisible(false);
  };

  const handleSavePreferences = () => {
    saveCookiePreferences(preferences);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[2px] transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Banner */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] animate-slide-up"
        role="dialog"
        aria-label={tr.dashboard.components.cookieConsent.title}
      >
        <div className="mx-auto max-w-4xl px-4 pb-6">
          <div
            className="rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/10 overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                  >
                    <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                    <path d="M8.5 8.5v.01" />
                    <path d="M16 15.5v.01" />
                    <path d="M12 12v.01" />
                    <path d="M11 17v.01" />
                    <path d="M7 14v.01" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-semibold text-foreground">
                    {tr.dashboard.components.cookieConsent.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {tr.dashboard.components.cookieConsent.description}
                    {" "}
                    <Link
                      href="/privacy"
                      className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                    >
                      {tr.dashboard.components.cookieConsent.privacyPolicy}
                    </Link>
                  </p>
                </div>
              </div>
            </div>

            {/* Details Panel */}
            {showDetails && (
              <div className="mx-6 mb-4 rounded-xl border border-border/40 bg-muted/30 p-4 space-y-3">
                {/* Essential */}
                <label className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[13px] font-medium text-foreground">
                      {tr.dashboard.components.cookieConsent.essential.title}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {tr.dashboard.components.cookieConsent.essential.description}
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked
                      disabled
                      className="sr-only peer"
                    />
                    <div className="h-5 w-9 rounded-full bg-primary/80 peer-focus:ring-2 cursor-not-allowed opacity-70">
                      <div className="absolute top-0.5 left-[18px] h-4 w-4 rounded-full bg-white shadow transition-all" />
                    </div>
                  </div>
                </label>

                {/* Analytics */}
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="text-[13px] font-medium text-foreground">
                      {tr.dashboard.components.cookieConsent.analytics.title}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {tr.dashboard.components.cookieConsent.analytics.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preferences.analytics}
                    onClick={() =>
                      setPreferences((p) => ({
                        ...p,
                        analytics: !p.analytics,
                      }))
                    }
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      preferences.analytics
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        preferences.analytics ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </label>

                {/* Marketing */}
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="text-[13px] font-medium text-foreground">
                      {tr.dashboard.components.cookieConsent.marketing.title}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {tr.dashboard.components.cookieConsent.marketing.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preferences.marketing}
                    onClick={() =>
                      setPreferences((p) => ({
                        ...p,
                        marketing: !p.marketing,
                      }))
                    }
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      preferences.marketing
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        preferences.marketing ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </label>
              </div>
            )}

            {/* Actions */}
            <div className="px-6 pb-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="order-3 sm:order-1 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
              >
                {showDetails ? tr.dashboard.components.cookieConsent.hide : tr.dashboard.components.cookieConsent.manage}
              </button>
              <div className="flex-1" />
              {showDetails ? (
                <button
                  onClick={handleSavePreferences}
                  className="order-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  {tr.common.save}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleAcceptEssential}
                    className="order-2 sm:order-2 rounded-xl border border-border px-5 py-2.5 text-[13px] font-semibold text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {tr.dashboard.components.cookieConsent.onlyEssential}
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    className="order-1 sm:order-3 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    {tr.dashboard.components.cookieConsent.acceptAll}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  );
}
