"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import {
  UserPlus,
  Search,
  BarChart3,
  List,
  LineChart,
  Star,
  Bell,
  Calculator,
  TrendingUp,
  Shield,
  RefreshCw,
  Lock,
  ArrowRight,
  ChevronRight,
  Zap,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { api, PublicSummary } from "@/lib/api-client";
import { cn, formatDecimal, formatPercentFromDecimal, formatPercent, formatDate } from "@/lib/utils";
import { tr } from "@/locales/tr";
import { APP_VERSION } from "@/lib/constants";

export default function LandingPage() {
  const [summary, setSummary] = useState<PublicSummary | null>(null);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [filterDays, setFilterDays] = useState(1); // Default: Yarın (1 gün kalanlar)


  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  useEffect(() => {
    api.admin
      .publicSummary()
      .then(setSummary)
      .catch(() => { });
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ═══════ Navbar ═══════ */}
      <nav className="apple-navbar sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Bondley Logo"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
            <span className="hidden sm:inline font-semibold text-[16px] tracking-tight text-foreground">
              {tr.common.brand}
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {mounted && user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-[14px] text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  {tr.landing.nav.dashboard}
                </Link>
                <ThemeToggle />
                <UserMenu />
              </>
            ) : (
              <>
                <ThemeToggle />
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-[14px]">
                    {tr.landing.nav.login}
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="text-[14px]">
                    {tr.landing.nav.signup}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══════ Hero — full-width, Apple keynote style ═══════ */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
        </div>

        <div className="container mx-auto text-center relative z-10">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/15 bg-primary/5 px-5 py-2 mb-10">
              <span className="h-1.5 w-1.5 rounded-full bg-positive live-indicator" />
              <span className="text-[13px] font-medium text-primary">
                {tr.landing.hero.badge}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-primary/50" />
            </div>
          </div>

          <h1 className="text-display-xl md:text-[4.5rem] md:leading-[1.04] lg:text-[5.5rem] lg:leading-[1.02] text-foreground tracking-tight max-w-6xl mx-auto animate-fade-up">
            {tr.landing.hero.titleLine1}
            <br />
            <span className="text-primary">{tr.landing.hero.titleLine2}</span>
          </h1>

          <p className="text-body-lg md:text-[1.25rem] md:leading-[1.6] text-muted-foreground max-w-4xl mx-auto mt-8 animate-fade-up-delay-1">
            {tr.landing.hero.description}
          </p>

          <div className="flex items-center justify-center gap-4 mt-10 animate-fade-up-delay-2">
            <Link href={user ? "/dashboard" : "/signup"}>
              <Button size="lg" className="px-8 text-[17px] h-14 rounded-2xl shadow-md hover:shadow-lg">
                {user ? tr.landing.nav.dashboard : tr.landing.hero.ctaStart}
                <ArrowRight className="h-5 w-5 ml-1" />
              </Button>
            </Link>
            {!user && (
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 text-[17px] h-14 rounded-2xl"
                >
                  {tr.landing.hero.ctaLogin}
                </Button>
              </Link>
            )}
          </div>

          {/* ═══════ Veri Açıklanması Yaklaşanlar (Filtreleme Sistemi) ═══════ */}
          {summary?.upcoming_bonds && summary.upcoming_bonds.length > 0 && (
            <div className="mt-16 md:mt-20 animate-fade-up-delay-3 max-w-5xl mx-auto px-4 md:px-0">
              <div className="flex items-center justify-center gap-3 mb-8">
                <div className="h-px w-12 bg-primary/20" />
                <span className="text-[13px] font-semibold text-primary uppercase tracking-[0.2em]">
                  {filterDays === 0 
                    ? tr.landing.upcoming.titleToday 
                    : filterDays === 1 
                      ? tr.landing.upcoming.titleTomorrow 
                      : tr.landing.upcoming.titleDayAfter}
                </span>
                <div className="h-px w-12 bg-primary/20" />
              </div>

              {/* Day Filter Segmented Control */}
              <div className="flex items-center justify-center mb-10">
                <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-secondary/50 border border-border/50 backdrop-blur-sm">
                  {[
                    { val: 0, label: tr.landing.upcoming.filterToday },
                    { val: 1, label: tr.landing.upcoming.filterTomorrow },
                    { val: 2, label: tr.landing.upcoming.filterDayAfter },
                  ].map((d) => (
                    <button
                      key={d.val}
                      onClick={() => setFilterDays(d.val)}
                      className={cn(
                        "px-6 py-2 rounded-xl text-[14px] font-medium transition-all duration-300",
                        filterDays === d.val
                          ? "bg-background text-primary shadow-sm border border-border/40"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {summary.upcoming_bonds
                  .filter(b => b.days_to_coupon === filterDays)
                  .map((b) => (
                    <Link
                      key={b.isin_code}
                      href={user ? `/dashboard/bonds/${b.isin_code}` : "/signup"}
                      className="group relative flex flex-col items-start p-5 rounded-2xl bg-card border border-border/50 hover:border-primary/40 hover:shadow-md transition-all duration-300 w-[240px] text-left"
                    >
                      <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-positive animate-pulse" />
                      <span className="font-mono-data font-bold text-[16px] text-foreground mb-1">
                        {b.isin_code}
                      </span>
                      <span className="text-[13px] text-muted-foreground line-clamp-1 mb-3">
                        {b.issuer || "—"}
                      </span>
                      <div className="flex items-center text-[12px] font-medium text-primary group-hover:translate-x-1 transition-transform">
                        {tr.landing.upcoming.seeMore} <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </div>
                    </Link>
                  ))}
                
                {summary.upcoming_bonds.filter(b => b.days_to_coupon === filterDays).length === 0 && (
                  <div className="py-12 text-center w-full">
                    <p className="text-muted-foreground text-[15px]">
                      Bu gün için beklenen veri açıklaması bulunmuyor.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>



      {/* ═══════ Live Data Ticker — Apple product spec style ═══════ */}
      <section className="container mx-auto pb-24">
        <div className="animate-fade-up-delay-3">
          <div className="rounded-3xl border border-border bg-card shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-8 py-5 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-positive live-indicator" />
                <span className="text-[15px] font-semibold text-foreground">
                  {tr.landing.ticker.title}
                </span>
              </div>
              <span className="text-[13px] text-muted-foreground">
                {summary?.tlref_date ? formatDate(summary.tlref_date) : "—"}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {[
                {
                  label: tr.landing.ticker.labels.tlrefIndex,
                  value: formatDecimal(summary?.tlref_index, 2),
                  highlight: true,
                  large: true,
                },
                ...(summary?.tlref_index_change_pct != null
                  ? [
                    {
                      label: tr.landing.ticker.labels.comparedToYesterday,
                      value: `${summary!.tlref_index_change_pct >= 0 ? "+" : ""}${summary!.tlref_index_change_pct}%`,
                      positive: summary!.tlref_index_change_pct >= 0,
                    },
                  ]
                  : [{ label: tr.landing.ticker.labels.comparedToYesterday, value: "—" }]),
                {
                  label: tr.landing.ticker.labels.dailyRate,
                  value: formatPercent(summary?.tlref_daily_rate, 4),
                  positive: true,
                },
                {
                  label: tr.landing.ticker.labels.annualizedRate,
                  value:
                    summary?.tlref_annualized_rate != null
                      ? formatPercent(summary.tlref_annualized_rate)
                      : "—",
                },
                {
                  label: tr.landing.ticker.labels.totalBonds,
                  value: formatDecimal(summary?.total_bonds, 0),
                },
                {
                  label: tr.landing.ticker.labels.totalRecords,
                  value: formatDecimal(summary?.total_tlref_records, 0),
                },
                { label: tr.landing.ticker.labels.lastDate, value: formatDate(summary?.tlref_date) },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col justify-center px-6 py-6 border-b md:border-b-0 md:border-r border-border/30 last:border-0"
                >
                  <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1.5">
                    {item.label}
                  </span>
                  <span
                    className={`font-mono-data ${(item as any).large
                      ? "text-[1.75rem] font-bold leading-none"
                      : "text-[1.125rem] font-semibold leading-tight"
                      } ${(item as any).highlight
                        ? "text-primary"
                        : (item as any).positive
                          ? "text-positive"
                          : "text-foreground"
                      }`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ How it Works — 3 steps, expansive ═══════ */}
      <section className="py-28 bg-secondary/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <span className="text-[13px] font-medium text-primary uppercase tracking-wider">
              {tr.landing.howItWorks.badge}
            </span>
            <h2 className="text-display-lg md:text-[2.75rem] text-foreground mt-3 tracking-tight">
              {tr.landing.howItWorks.title}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 lg:gap-14">
            {[
              { step: "01", icon: UserPlus },
              { step: "02", icon: Search },
              { step: "03", icon: BarChart3 },
            ].map((item, i) => (
            <div
              key={item.step}
              className="group relative bg-card rounded-3xl border border-border p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300"
            >
              <span className="text-[4rem] font-bold text-border/70 leading-none absolute top-6 right-8 select-none pointer-events-none">
                {item.step}
              </span>
              <div className="relative z-10">
                <div className="rounded-2xl bg-primary/8 w-14 h-14 flex items-center justify-center mb-6">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-[20px] text-foreground mb-3 tracking-tight">
                  {tr.landing.howItWorks.steps[i].title}
                </h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  {tr.landing.howItWorks.steps[i].desc}
                </p>
              </div>
            </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ Stats Callout — Apple number band ═══════ */}
      <section className="py-28">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <span className="text-[13px] font-medium text-primary uppercase tracking-wider">
              {tr.landing.stats.badge}
            </span>
            <h2 className="text-display-lg md:text-[2.75rem] text-foreground mt-3 tracking-tight">
              {tr.landing.stats.title}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { label: "bonds", number: "2.100+", icon: TrendingUp },
              { label: "tlref", number: "1.700+", icon: LineChart },
              { label: "update", number: "Her Gün", icon: RefreshCw },
            ].map((item, i) => (
            <div
              key={item.label}
              className="bg-card rounded-3xl border border-border p-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-center hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow"
            >
              <div className="rounded-2xl bg-primary/8 w-14 h-14 flex items-center justify-center mx-auto mb-6">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="font-mono-data text-[2.5rem] font-bold text-primary leading-none mb-3 tracking-tight">
                {item.number}
              </div>
              <div className="text-[15px] font-semibold text-foreground mb-3">
                {tr.landing.stats.items[i].label}
              </div>
              <p className="text-[15px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {tr.landing.stats.items[i].desc}
              </p>
            </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ Features Grid — Apple icon grid ═══════ */}
      <section className="py-28 bg-secondary/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <span className="text-[13px] font-medium text-primary uppercase tracking-wider">
              {tr.landing.features.badge}
            </span>
            <h2 className="text-display-lg md:text-[2.75rem] text-foreground mt-3 tracking-tight">
              {tr.landing.features.title}
            </h2>
            <p className="text-[17px] text-muted-foreground mt-4 max-w-xl mx-auto">
              {tr.landing.features.description}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "bonds", icon: List },
              { title: "tlref", icon: LineChart },
              { title: "favorites", icon: Star },
              { title: "alerts", icon: Bell },
              { title: "yield", icon: Calculator },
              { title: "market", icon: Shield },
            ].map((item, i) => (
            <div
              key={item.title}
              className="group rounded-3xl border border-border bg-card p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300"
            >
              <div className="rounded-2xl bg-primary/8 w-12 h-12 flex items-center justify-center mb-5 group-hover:bg-primary/12 transition-colors">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-[17px] text-foreground mb-2 tracking-tight">
                {tr.landing.features.items[i].title}
              </h3>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                {tr.landing.features.items[i].desc}
              </p>
            </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA Banner ═══════ */}
      <section className="py-28">
        <div className="container mx-auto">
          <div className="rounded-3xl bg-primary/[0.04] border border-primary/10 p-16 text-center relative overflow-hidden">
            {/* Subtle glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/[0.06] blur-[100px] pointer-events-none" />
            <div className="relative z-10">
              <Zap className="h-10 w-10 text-primary mx-auto mb-6" />
              <h2 className="text-display-lg md:text-[2.75rem] text-foreground tracking-tight mb-4">
                {tr.landing.cta.title}
              </h2>
              <p className="text-[17px] text-muted-foreground max-w-lg mx-auto mb-10">
                {tr.landing.cta.description}
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link href={user ? "/dashboard" : "/signup"}>
                  <Button size="lg" className="px-8 text-[17px] h-14 rounded-2xl shadow-md">
                    {user ? tr.landing.nav.dashboard : tr.landing.cta.button}
                    <ArrowRight className="h-5 w-5 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ Trust Bar ═══════ */}
      <section className="container mx-auto pb-20">
        <div className="flex flex-wrap justify-center gap-x-16 gap-y-6">
          {[
            { icon: Shield, text: tr.landing.trust[0] },
            { icon: RefreshCw, text: tr.landing.trust[1] },
            { icon: Lock, text: tr.landing.trust[2] },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3">
              <item.icon className="h-5 w-5 text-primary/70 shrink-0" />
              <span className="text-[15px] text-muted-foreground">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ Footer ═══════ */}
      <footer className="border-t border-border/50">
        <div className="container mx-auto py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Bondley"
                width={20}
                height={20}
                className="h-5 w-5 object-contain opacity-60"
              />
              <span className="text-[13px] text-muted-foreground">
                &copy; 2026 Bondley
              </span>
              <span className="text-[11px] text-muted-foreground/30 font-mono-data">v{APP_VERSION}</span>
            </div>
            <div className="flex items-center gap-8 text-[13px] text-muted-foreground">
              <Link
                href="/gizlilik"
                className="hover:text-primary transition-colors"
              >
                {tr.landing.footer.privacy}
              </Link>
              <Link
                href="/kullanim-sartlari"
                className="hover:text-primary transition-colors"
              >
                {tr.landing.footer.terms}
              </Link>
              <Link
                href="/iletisim"
                className="hover:text-primary transition-colors"
              >
                {tr.landing.footer.contact}
              </Link>
            </div>
            <span className="text-[13px] text-muted-foreground/50">
              {tr.landing.footer.location}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
