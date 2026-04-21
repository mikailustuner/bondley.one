"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, TrendingUp, Clock, Star as StarIcon, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TlrefIndexChart } from "@/components/charts/tlref-index-chart";
import { TlrefRateChart } from "@/components/charts/tlref-rate-chart";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton-components";
import { Skeleton } from "@/components/ui/skeleton";
import { useTlrefHistory } from "@/hooks/use-tlref-history";
import { useUsageSummary } from "@/hooks/use-usage-summary";
import { api, BondListItem } from "@/lib/api-client";
import { getToken, getUser } from "@/lib/auth";
import { formatDecimal, formatPercentFromDecimal, formatPercent, formatDate } from "@/lib/utils";
import { tr } from "@/locales/tr";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return tr.dashboard.overview.greetings.night;
  if (h < 12) return tr.dashboard.overview.greetings.morning;
  if (h < 18) return tr.dashboard.overview.greetings.day;
  return tr.dashboard.overview.greetings.evening;
}

function getTodayText(): string {
  return new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [favoriteBonds, setFavoriteBonds] = useState<BondListItem[]>([]);
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [quickSearchResults, setQuickSearchResults] = useState<BondListItem[]>([]);
  const [quickSearchLoading, setQuickSearchLoading] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const quickSearchRef = useRef<HTMLDivElement>(null);
  const [soonMaturing, setSoonMaturing] = useState<BondListItem[]>([]);
  const [highYield, setHighYield] = useState<BondListItem[]>([]);
  const userName = getUser()?.full_name || "User";

  useEffect(() => {
    document.title = `Dashboard — ${tr.common.brand}`;
    return () => {
      document.title = tr.common.brand;
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.bonds
      .favoritesList(token)
      .then((res) => setFavoriteBonds(res.items || []))
      .catch(() => setFavoriteBonds([]));
  }, []);

  useEffect(() => {
    if (quickSearchQuery.trim().length < 2) {
      setQuickSearchResults([]);
      setQuickSearchOpen(false);
      return;
    }
    const token = getToken();
    if (!token) return;
    const t = setTimeout(() => {
      setQuickSearchLoading(true);
      api.bonds
        .list(token, { search: quickSearchQuery.trim(), limit: 8, active_only: true })
        .then((res) => {
          setQuickSearchResults(res.items || []);
          setQuickSearchOpen((res.items?.length ?? 0) > 0);
        })
        .catch(() => {
          setQuickSearchResults([]);
          setQuickSearchOpen(false);
        })
        .finally(() => setQuickSearchLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [quickSearchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (quickSearchRef.current && !quickSearchRef.current.contains(event.target as Node)) {
        setQuickSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    Promise.all([
      api.bonds.list(token, { limit: 5, order_by: "days_to_maturity_asc", max_days_to_maturity: 90, active_only: true }),
      api.bonds.list(token, { limit: 5, order_by: "last_issue_yield_desc", active_only: true }),
    ])
      .then(([soonRes, yieldRes]) => {
        setSoonMaturing(soonRes.items || []);
        setHighYield(yieldRes.items || []);
      })
      .catch(() => { });
  }, []);

  const { history, indexData, rateData, stats, bondStats, loading, error } = useTlrefHistory();
  const { summary: usageSummary } = useUsageSummary();

  return (
    <div className="space-y-8">
      {/* ═══ Greeting + Search ═══ */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 animate-fade-up">
        <div>
          <h1 className="text-display-lg text-foreground tracking-tight">
            {getGreeting()}, {userName.split(" ")[0]}.
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1">
            {getTodayText()}
          </p>
        </div>
        <div ref={quickSearchRef} className="relative w-full md:w-[340px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[16px] w-[16px] pointer-events-none text-muted-foreground/50" />
          <Input
            type="search"
            placeholder={tr.dashboard.overview.search.placeholder}
            value={quickSearchQuery}
            onChange={(e) => setQuickSearchQuery(e.target.value)}
            onFocus={() => quickSearchResults.length > 0 && setQuickSearchOpen(true)}
            className="pl-10 h-10 rounded-2xl bg-secondary/50 border-transparent hover:bg-secondary/80 focus-visible:bg-card focus-visible:border-border text-[14px]"
            aria-label={tr.dashboard.overview.search.ariaLabel}
            autoComplete="off"
          />
          {quickSearchOpen && (
            <ul className="absolute top-full left-0 right-0 z-50 mt-2 max-h-64 overflow-auto rounded-2xl border border-border bg-card py-1.5 shadow-lg">
              {quickSearchLoading && (
                <li className="px-4 py-3 text-[13px] text-muted-foreground">{tr.dashboard.overview.search.searching}</li>
              )}
              {!quickSearchLoading &&
                quickSearchResults.map((b) => (
                  <li key={b.isin_code} role="option">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-[13px] hover:bg-secondary/60 focus:bg-secondary/60 focus:outline-none transition-colors"
                      onClick={() => {
                        setQuickSearchQuery("");
                        setQuickSearchOpen(false);
                        setQuickSearchResults([]);
                        router.push(`/dashboard/bonds/${encodeURIComponent(b.isin_code)}`);
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-medium text-foreground">{b.isin_code}</span>
                        {b.issuer && <span className="truncate text-muted-foreground text-[12px]">{b.issuer}</span>}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    </button>
                  </li>
                ))}
              {!quickSearchLoading && quickSearchResults.length === 0 && quickSearchQuery.trim().length >= 2 && (
                <li className="px-4 py-3 text-[13px] text-muted-foreground">{tr.dashboard.overview.search.noResults}</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* ═══ Loading ═══ */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-3xl border border-border bg-card p-6">
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-9 w-24 mb-2" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}

      {/* ═══ Error ═══ */}
      {error && (
        <div className="p-5 rounded-3xl border border-destructive/20 bg-destructive/5 text-destructive text-[15px]">
          {error}
        </div>
      )}

      {/* ═══ Stat Widgets ═══ */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-up">
          {/* TLREF Endeks — highlight */}
          <div className="widget-blue rounded-3xl border border-primary/10 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[12px] font-semibold text-primary/70 uppercase tracking-wider mb-3">{tr.dashboard.overview.widgets.tlrefIndex}</div>
            <div className="font-mono-data text-[2.25rem] font-bold text-primary leading-none tracking-tight">
              {formatDecimal(stats.latest_index, 2)}
            </div>
            <div className="text-[13px] text-muted-foreground mt-2.5">
              {stats.latest_date ? formatDate(stats.latest_date) : ""}
            </div>
          </div>

          {/* Günlük Oran */}
          <div className="widget-green rounded-3xl border border-border p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">{tr.dashboard.overview.widgets.dailyRate}</div>
            <div className="font-mono-data text-[2.25rem] font-bold text-positive leading-none tracking-tight">
              {formatPercentFromDecimal(stats.latest_daily_rate, 4)}
            </div>
            <div className="text-[13px] text-muted-foreground mt-2.5">{tr.dashboard.overview.widgets.dailyRateDesc}</div>
          </div>

          {/* Yıllık Oran */}
          <div className="widget-purple rounded-3xl border border-border p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">{tr.dashboard.overview.widgets.annualizedRate}</div>
            <div className="font-mono-data text-[2.25rem] font-bold text-foreground leading-none tracking-tight">
              {stats.annualized_rate_pct != null ? formatPercent(stats.annualized_rate_pct) : "—"}
            </div>
            <div className="text-[13px] text-muted-foreground mt-2.5">{tr.dashboard.overview.widgets.annualizedRateDesc}</div>
          </div>

          {/* Aktif Araç */}
          <Link href="/dashboard/bonds">
            <div className="widget-orange rounded-3xl border border-border p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-border transition-all group">
              <div className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">{tr.dashboard.overview.widgets.activeBonds}</div>
              <div className="font-mono-data text-[2.25rem] font-bold text-foreground leading-none tracking-tight">
                {bondStats ? formatDecimal(bondStats.total_bonds, 0) : "—"}
              </div>
              <div className="flex items-center gap-1.5 mt-2.5">
                <span className="text-[13px] text-muted-foreground">
                  {bondStats?.avg_days_to_maturity 
                    ? tr.dashboard.overview.widgets.avgMaturity.replace("{days}", Math.round(bondStats.avg_days_to_maturity).toString()) 
                    : tr.dashboard.overview.widgets.bondsDesc}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* ═══ Maturity Buckets — Pill Bar ═══ */}
      {bondStats?.by_maturity_bucket && (bondStats.by_maturity_bucket.short + bondStats.by_maturity_bucket.medium + bondStats.by_maturity_bucket.long) > 0 && (
        <div className="animate-fade-up-delay-1">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[13px] font-medium text-muted-foreground mb-4">{tr.dashboard.overview.maturity.title}</div>
            <div className="flex rounded-full overflow-hidden h-3 bg-secondary">
              {(() => {
                const total = bondStats.by_maturity_bucket.short + bondStats.by_maturity_bucket.medium + bondStats.by_maturity_bucket.long;
                return (
                  <>
                    <div className="bg-primary h-full transition-all" style={{ width: `${(bondStats.by_maturity_bucket.short / total) * 100}%` }} />
                    <div className="bg-primary/50 h-full transition-all" style={{ width: `${(bondStats.by_maturity_bucket.medium / total) * 100}%` }} />
                    <div className="bg-primary/20 h-full transition-all" style={{ width: `${(bondStats.by_maturity_bucket.long / total) * 100}%` }} />
                  </>
                );
              })()}
            </div>
            <div className="flex justify-between mt-3 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {tr.dashboard.overview.maturity.short.replace("{count}", formatDecimal(bondStats.by_maturity_bucket.short, 0))}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary/50" />
                {tr.dashboard.overview.maturity.medium.replace("{count}", formatDecimal(bondStats.by_maturity_bucket.medium, 0))}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary/20" />
                {tr.dashboard.overview.maturity.long.replace("{count}", formatDecimal(bondStats.by_maturity_bucket.long, 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Lists: Soon Maturing + High Yield ═══ */}
      {(soonMaturing.length > 0 || highYield.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2 animate-fade-up-delay-1">
          {soonMaturing.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-[15px]">{tr.dashboard.overview.lists.soonMaturing.title}</CardTitle>
                </div>
                <CardDescription>{tr.dashboard.overview.lists.soonMaturing.desc}</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-0">
                  {soonMaturing.map((b) => (
                    <Link
                      key={b.isin_code}
                      href={`/dashboard/bonds/${encodeURIComponent(b.isin_code)}`}
                      className="flex items-center justify-between rounded-xl py-3 px-3 -mx-1 hover:bg-secondary/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono-data text-[13px] font-medium text-foreground">{b.isin_code}</span>
                        <span className="text-[12px] text-muted-foreground truncate max-w-[120px]">{b.issuer ?? "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono-data text-[13px] text-muted-foreground">
                          {b.days_to_maturity != null ? `${b.days_to_maturity}g` : "—"}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {highYield.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-positive" />
                  <CardTitle className="text-[15px]">{tr.dashboard.overview.lists.highYield.title}</CardTitle>
                </div>
                <CardDescription>{tr.dashboard.overview.lists.highYield.desc}</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-0">
                  {highYield.map((b) => (
                    <Link
                      key={b.isin_code}
                      href={`/dashboard/bonds/${encodeURIComponent(b.isin_code)}`}
                      className="flex items-center justify-between rounded-xl py-3 px-3 -mx-1 hover:bg-secondary/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono-data text-[13px] font-medium text-foreground">{b.isin_code}</span>
                        <span className="text-[12px] text-muted-foreground truncate max-w-[120px]">{b.issuer ?? "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono-data text-[13px] text-positive font-medium">
                          {b.last_issue_yield != null ? formatPercent(b.last_issue_yield) : "—"}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══ Favorites ═══ */}
      {favoriteBonds.length > 0 && (
        <Card className="animate-fade-up-delay-1">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <StarIcon className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              <CardTitle className="text-[15px]">{tr.dashboard.overview.lists.favorites}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-wrap gap-2">
              {favoriteBonds.map((b) => (
                <Link
                  key={b.isin_code}
                  href={`/dashboard/bonds/${encodeURIComponent(b.isin_code)}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-secondary/40 px-4 py-2 text-[13px] text-foreground hover:bg-secondary/70 transition-colors"
                >
                  <span className="font-mono-data font-medium">{b.isin_code}</span>
                  {b.issuer && <span className="text-muted-foreground text-[12px] truncate max-w-[100px]">{b.issuer}</span>}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Usage Summary ═══ */}
      {usageSummary && (
        <Card className="animate-fade-up-delay-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-[15px]">{tr.dashboard.overview.lists.usage.title}</CardTitle>
            </div>
            <CardDescription>
              {tr.dashboard.overview.lists.usage.desc.replace("{count}", usageSummary.this_month_bonds_viewed.toString())}
            </CardDescription>
          </CardHeader>
          {usageSummary.most_viewed_bonds.length > 0 && (
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-2">
                {usageSummary.most_viewed_bonds.map((b) => (
                  <Link
                    key={b.isin_code}
                    href={`/dashboard/bonds/${encodeURIComponent(b.isin_code)}`}
                    className="inline-flex items-center gap-2 rounded-2xl bg-secondary/40 px-3 py-1.5 text-[13px] text-foreground hover:bg-secondary/70 transition-colors"
                  >
                    <span className="font-mono-data">{b.isin_code}</span>
                    <Badge variant="secondary" className="text-[10px]">{b.view_count}</Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ═══ TLREF Charts ═══ */}
      <div id="tlref-charts" className="space-y-5 animate-fade-up-delay-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>{tr.dashboard.overview.charts.index.desc}</CardDescription>
                <CardTitle className="mt-1">{tr.dashboard.overview.charts.index.title}</CardTitle>
              </div>
              <Badge variant="outline" className="rounded-xl">
                {tr.dashboard.overview.charts.index.badge.replace("{count}", history.length.toString())}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <TlrefIndexChart data={indexData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>{tr.dashboard.overview.charts.rate.desc}</CardDescription>
                <CardTitle className="mt-1">{tr.dashboard.overview.charts.rate.title}</CardTitle>
              </div>
              <Badge variant="outline" className="rounded-xl">{tr.dashboard.overview.charts.rate.badge}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <TlrefRateChart data={rateData} />
          </CardContent>
        </Card>
      </div>

      {/* ═══ Historical Table ═══ */}
      {history.length > 0 && (
        <Card className="animate-fade-up-delay-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>{tr.dashboard.overview.table.desc}</CardDescription>
                <CardTitle className="mt-1">{tr.dashboard.overview.table.title}</CardTitle>
              </div>
              <span className="text-[13px] font-medium text-muted-foreground">
                {tr.dashboard.overview.table.count.replace("{count}", history.length.toString())}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.overview.table.cols.date}</th>
                    <th scope="col" className="pb-3 text-right text-[13px] font-medium text-muted-foreground">{tr.dashboard.overview.table.cols.index}</th>
                    <th scope="col" className="pb-3 text-right text-[13px] font-medium text-muted-foreground">{tr.dashboard.overview.table.cols.rate}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history]
                    .reverse()
                    .slice(0, 50)
                    .map((r) => (
                      <tr
                        key={r.rate_date}
                        className="border-b border-border/30 last:border-0 hover:bg-secondary/40 transition-colors"
                      >
                        <td className="py-3 font-mono-data text-[13px] text-foreground">{formatDate(r.rate_date)}</td>
                        <td className="py-3 text-right font-mono-data text-[13px] text-primary">{formatDecimal(r.index_value, 5)}</td>
                        <td className="py-3 text-right font-mono-data text-[13px]">
                          {r.daily_rate != null ? (
                            <span className={r.daily_rate >= 0 ? "text-positive" : "text-negative"}>
                              {formatPercentFromDecimal(r.daily_rate, 5)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
