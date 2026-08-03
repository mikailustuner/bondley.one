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
        className="fixed inset-0 z-[9998] bg-[#021015]/70 backdrop-blur-[3px] transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Banner */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] animate-slide-up"
        role="dialog"
        aria-label={tr.dashboard.components.cookieConsent.title}
      >
        <div className="mx-auto max-w-3xl px-4 pb-5">
          <div
            className="overflow-hidden rounded-[14px] border border-[#28dfc1]/25 bg-[#071b21]/95 font-mono backdrop-blur-xl shadow-2xl shadow-black/40"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#28dfc1]/20 bg-[#28dfc1]/10">
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
                    className="text-[#28dfc1]"
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
                  <h3 className="text-[13px] font-semibold text-[#edfafa]">
                    {tr.dashboard.components.cookieConsent.title}
                  </h3>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#8eafb2]">
                    {tr.dashboard.components.cookieConsent.description}
                    {" "}
                    <Link
                      href="/privacy"
                      className="text-[#28dfc1] underline underline-offset-2 transition-colors hover:text-[#66f0d8]"
                    >
                      {tr.dashboard.components.cookieConsent.privacyPolicy}
                    </Link>
                  </p>
                </div>
              </div>
            </div>

            {/* Details Panel */}
            {showDetails && (
              <div className="mx-6 mb-4 space-y-3 rounded-[10px] border border-[#9bd5d9]/10 bg-[#0b252c] p-4">
                {/* Essential */}
                <label className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-medium text-[#edfafa]">
                      {tr.dashboard.components.cookieConsent.essential.title}
                    </span>
                    <p className="mt-0.5 text-[9px] text-[#67888c]">
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
                    <div className="h-5 w-9 cursor-not-allowed rounded-full bg-[#28dfc1]/80 opacity-70 peer-focus:ring-2">
                      <div className="absolute top-0.5 left-[18px] h-4 w-4 rounded-full bg-white shadow transition-all" />
                    </div>
                  </div>
                </label>

                {/* Analytics */}
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="text-[11px] font-medium text-[#edfafa]">
                      {tr.dashboard.components.cookieConsent.analytics.title}
                    </span>
                    <p className="mt-0.5 text-[9px] text-[#67888c]">
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
                        ? "bg-[#28dfc1]"
                        : "bg-[#67888c]/30"
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
                    <span className="text-[11px] font-medium text-[#edfafa]">
                      {tr.dashboard.components.cookieConsent.marketing.title}
                    </span>
                    <p className="mt-0.5 text-[9px] text-[#67888c]">
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
                        ? "bg-[#28dfc1]"
                        : "bg-[#67888c]/30"
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
                className="order-3 px-3 py-2 text-[10px] font-medium text-[#78999d] transition-colors hover:text-[#edfafa] sm:order-1"
              >
                {showDetails ? tr.dashboard.components.cookieConsent.hide : tr.dashboard.components.cookieConsent.manage}
              </button>
              <div className="flex-1" />
              {showDetails ? (
                <button
                  onClick={handleSavePreferences}
                  className="order-2 rounded-[8px] bg-[#28dfc1] px-5 py-2.5 text-[10px] font-semibold text-[#042a2a] shadow-sm transition-colors hover:bg-[#66f0d8]"
                >
                  {tr.common.save}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleAcceptEssential}
                    className="order-2 rounded-[8px] border border-[#9bd5d9]/20 px-5 py-2.5 text-[10px] font-semibold text-[#b7d1d3] transition-colors hover:bg-[#9bd5d9]/5 sm:order-2"
                  >
                    {tr.dashboard.components.cookieConsent.onlyEssential}
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    className="order-1 rounded-[8px] bg-[#28dfc1] px-5 py-2.5 text-[10px] font-semibold text-[#042a2a] shadow-sm transition-colors hover:bg-[#66f0d8] sm:order-3"
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
