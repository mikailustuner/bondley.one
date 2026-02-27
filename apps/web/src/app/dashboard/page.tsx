"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
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
import { getToken } from "@/lib/auth";
import { formatDecimal, formatPercentFromDecimal, formatPercent, formatDate } from "@/lib/utils";
import { useProMode } from "@/components/pro-mode-provider";

export default function DashboardPage() {
  const router = useRouter();
  const [favoriteBonds, setFavoriteBonds] = useState<BondListItem[]>([]);
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [quickSearchResults, setQuickSearchResults] = useState<BondListItem[]>([]);
  const [quickSearchLoading, setQuickSearchLoading] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const quickSearchRef = useRef<HTMLDivElement>(null);
  const { isPro } = useProMode();
  const [soonMaturing, setSoonMaturing] = useState<BondListItem[]>([]);
  const [highYield, setHighYield] = useState<BondListItem[]>([]);

  useEffect(() => {
    document.title = "Dashboard — Bondley";
    return () => {
      document.title = "Bondley";
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
        .list(token, { search: quickSearchQuery.trim(), limit: 10, active_only: true })
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

  const STATS = stats
    ? [
      {
        label: "TLREF ENDEKS",
        value: formatDecimal(stats.latest_index, 2),
        sub: stats.latest_date ? formatDate(stats.latest_date) : "",
        highlight: true,
      },
      {
        label: "GUNLUK ORAN",
        value: formatPercentFromDecimal(stats.latest_daily_rate, 4),
        sub: "Son iş günü",
      },
      {
        label: "YILLIK ORAN",
        value: stats.annualized_rate_pct != null ? formatPercent(stats.annualized_rate_pct) : "—",
        sub: "Bilesik yillik",
      },
      {
        label: "AKTİF MK",
        value: bondStats ? formatDecimal(bondStats.total_bonds, 0) : "—",
        sub: bondStats?.avg_days_to_maturity
          ? `Ort. vade: ${Math.round(bondStats.avg_days_to_maturity)} gün`
          : "",
        link: "/dashboard/bonds",
      },
    ]
    : [
      { label: "TLREF ENDEKS", value: "—", sub: "", highlight: true },
      { label: "GUNLUK ORAN", value: "—", sub: "" },
      { label: "YILLIK ORAN", value: "—", sub: "" },
      { label: "AKTİF MK", value: "—", sub: "" },
    ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block shrink-0">
          <h1 className="font-display text-display-md text-foreground">Dashboard</h1>
          <p className="text-data-sm text-muted-foreground mt-1">
            BIST TLREF Endeks & Borçlanma Araçları Terminali
          </p>
        </div>
        <div ref={quickSearchRef} className="relative flex-1 max-w-[600px] mx-auto">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 pointer-events-none ${isPro ? "text-primary/70" : "text-muted-foreground"}`} />
          <Input
            type="search"
            placeholder={isPro ? "> ISIN VEYA IHRACCI ARA..." : "ISIN veya ihraççı ara..."}
            value={quickSearchQuery}
            onChange={(e) => setQuickSearchQuery(e.target.value)}
            onFocus={() => quickSearchResults.length > 0 && setQuickSearchOpen(true)}
            className={`font-mono-data text-base pl-12 h-12 border-primary/40 bg-card hover:border-primary/60 transition-colors focus-visible:ring-primary shadow-sm ${isPro ? "rounded-none bg-black text-primary focus-visible:ring-1" : "rounded-xl"}`}
            aria-label="Borçlanma aracı ara"
            autoComplete="off"
          />
          {quickSearchOpen && (
            <ul
              className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg"
              role="listbox"
            >
              {quickSearchLoading && (
                <li className="px-3 py-2 text-data-sm text-muted-foreground">Aranıyor...</li>
              )}
              {!quickSearchLoading &&
                quickSearchResults.map((b) => (
                  <li key={b.isin_code} role="option">
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-data-sm hover:bg-secondary/50 focus:bg-secondary/50 focus:outline-none"
                      onClick={() => {
                        setQuickSearchQuery("");
                        setQuickSearchOpen(false);
                        setQuickSearchResults([]);
                        router.push(`/dashboard/bonds/${encodeURIComponent(b.isin_code)}`);
                      }}
                    >
                      <span className="font-mono font-medium text-foreground">{b.isin_code}</span>
                      {b.issuer && (
                        <span className="truncate text-muted-foreground">{b.issuer}</span>
                      )}
                    </button>
                  </li>
                ))}
              {!quickSearchLoading && quickSearchResults.length === 0 && quickSearchQuery.trim().length >= 2 && (
                <li className="px-3 py-2 text-data-sm text-muted-foreground">Sonuç bulunamadı</li>
              )}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-2 text-label text-muted-foreground shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-positive live-indicator" />
          CANLI
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-6">
          <div className="grid gap-px md:grid-cols-4 bg-border/30 rounded-lg overflow-hidden">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-[250px]" />
            </CardHeader>
            <CardContent>
              <SkeletonTable columns={3} rows={5} />
            </CardContent>
          </Card>
        </div>
      )}

      {stats?.latest_date && (
        <p className="text-label text-muted-foreground animate-fade-up">
          Son veri: {formatDate(stats.latest_date)}
        </p>
      )}

      <div className="grid gap-px md:grid-cols-4 bg-border/30 rounded-lg overflow-hidden animate-fade-up">
        {STATS.map((stat) => {
          const inner = (
            <div
              className={`bg-card p-5 grain ${stat.highlight ? "amber-glow-border" : ""} ${(stat as any).link ? "cursor-pointer hover:bg-secondary/30 transition-colors" : ""}`}
            >
              <div className="text-label text-muted-foreground mb-2">{stat.label}</div>
              <div
                className={`font-mono-data text-stat ${stat.highlight ? "text-primary" : "text-foreground"}`}
              >
                {stat.value}
              </div>
              <div className="text-label text-muted-foreground mt-1">{stat.sub}</div>
            </div>
          );
          return (stat as any).link ? (
            <Link key={stat.label} href={(stat as any).link}>
              {inner}
            </Link>
          ) : (
            <div key={stat.label}>{inner}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up">
        <Link
          href="/dashboard/bonds"
          className="rounded-lg border border-border bg-card p-4 grain hover:bg-secondary/30 transition-colors text-left"
        >
          <div className="text-label text-muted-foreground mb-1">Borçlanma Araçları</div>
          <div className="text-data-sm font-medium text-foreground">Borçlanma araçları listesi</div>
        </Link>
        <Link
          href="/dashboard/alerts"
          className="rounded-lg border border-border bg-card p-4 grain hover:bg-secondary/30 transition-colors text-left"
        >
          <div className="text-label text-muted-foreground mb-1">Uyarılar</div>
          <div className="text-data-sm font-medium text-foreground">Fiyat ve vade uyarıları</div>
        </Link>
        <Link
          href="/dashboard/analytics"
          className="rounded-lg border border-border bg-card p-4 grain hover:bg-secondary/30 transition-colors text-left"
        >
          <div className="text-label text-muted-foreground mb-1">Analiz</div>
          <div className="text-data-sm font-medium text-foreground">Piyasa dağılımları</div>
        </Link>
        <a
          href="#tlref-charts"
          className="rounded-lg border border-border bg-card p-4 grain hover:bg-secondary/30 transition-colors text-left"
        >
          <div className="text-label text-muted-foreground mb-1">TLREF</div>
          <div className="text-data-sm font-medium text-foreground">Endeks ve oran grafikleri</div>
        </a>
      </div>

      {bondStats?.by_maturity_bucket && (bondStats.by_maturity_bucket.short + bondStats.by_maturity_bucket.medium + bondStats.by_maturity_bucket.long) > 0 && (
        <div className="grid gap-px md:grid-cols-3 bg-border/30 rounded-lg overflow-hidden animate-fade-up">
          <div className="bg-card p-4 grain">
            <div className="text-label text-muted-foreground mb-1">Kısa vade (&lt;1 yıl)</div>
            <div className="font-mono-data text-lg text-foreground">
              {formatDecimal(bondStats.by_maturity_bucket.short, 0)}
            </div>
          </div>
          <div className="bg-card p-4 grain">
            <div className="text-label text-muted-foreground mb-1">Orta (1–5 yıl)</div>
            <div className="font-mono-data text-lg text-foreground">
              {formatDecimal(bondStats.by_maturity_bucket.medium, 0)}
            </div>
          </div>
          <div className="bg-card p-4 grain">
            <div className="text-label text-muted-foreground mb-1">Uzun (5 yıl+)</div>
            <div className="font-mono-data text-lg text-foreground">
              {formatDecimal(bondStats.by_maturity_bucket.long, 0)}
            </div>
          </div>
        </div>
      )}

      {(soonMaturing.length > 0 || highYield.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2 animate-fade-up">
          {soonMaturing.length > 0 && (
            <Card>
              <CardHeader>
                <CardDescription>VADESİ YAKLAŞAN</CardDescription>
                <CardTitle className="mt-1">90 gün içinde vadesi dolan borçlanma araçları</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {soonMaturing.map((b) => (
                    <li key={b.isin_code}>
                      <Link
                        href={`/dashboard/bonds/${encodeURIComponent(b.isin_code)}`}
                        className="flex items-center justify-between rounded-md py-1.5 px-2 hover:bg-secondary/50 transition-colors text-data-sm"
                      >
                        <span className="font-mono font-medium text-foreground">{b.isin_code}</span>
                        <span className="text-muted-foreground truncate max-w-[140px]">{b.issuer ?? "—"}</span>
                        <span className="font-mono-data text-muted-foreground shrink-0">
                          {b.days_to_maturity != null ? `${b.days_to_maturity} gün` : "—"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {highYield.length > 0 && (
            <Card>
              <CardHeader>
                <CardDescription>YÜKSEK GETİRİLİ</CardDescription>
                <CardTitle className="mt-1">Son ihraç getirisi yüksek borçlanma araçları</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {highYield.map((b) => (
                    <li key={b.isin_code}>
                      <Link
                        href={`/dashboard/bonds/${encodeURIComponent(b.isin_code)}`}
                        className="flex items-center justify-between rounded-md py-1.5 px-2 hover:bg-secondary/50 transition-colors text-data-sm"
                      >
                        <span className="font-mono font-medium text-foreground">{b.isin_code}</span>
                        <span className="text-muted-foreground truncate max-w-[140px]">{b.issuer ?? "—"}</span>
                        <span className="font-mono-data text-primary shrink-0">
                          {b.last_issue_yield != null ? formatPercent(b.last_issue_yield) : "—"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {usageSummary && (
        <Card className="animate-fade-up-delay-1">
          <CardHeader>
            <CardDescription>KULLANIM ÖZETİ</CardDescription>
            <CardTitle className="mt-1">Bu ay {usageSummary.this_month_bonds_viewed} borçlanma aracı incelediniz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {usageSummary.most_viewed_bonds.length > 0 ? (
              <>
                <p className="text-label text-muted-foreground">En çok baktığınız borçlanma araçları:</p>
                <ul className="flex flex-wrap gap-2">
                  {usageSummary.most_viewed_bonds.map((b) => (
                    <li key={b.isin_code}>
                      <Link
                        href={`/dashboard/bonds/${encodeURIComponent(b.isin_code)}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-1 text-data-sm text-foreground hover:bg-secondary transition-colors"
                      >
                        <span className="font-mono">{b.isin_code}</span>
                        {b.issuer && <span className="text-muted-foreground truncate max-w-[120px]">{b.issuer}</span>}
                        <Badge variant="secondary" className="text-xs">{b.view_count}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-data-sm text-muted-foreground">Bu dönemde henüz inceleme yok.</p>
            )}
          </CardContent>
        </Card>
      )}

      {favoriteBonds.length > 0 && (
        <Card className="animate-fade-up-delay-1">
          <CardHeader>
            <CardDescription>FAVORİLERİM</CardDescription>
            <CardTitle className="mt-1">Favori borçlanma araçlarınıza hızlı erişim</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {favoriteBonds.map((b) => (
                <li key={b.isin_code}>
                  <Link
                    href={`/dashboard/bonds/${encodeURIComponent(b.isin_code)}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-1 text-data-sm text-foreground hover:bg-secondary transition-colors"
                  >
                    <span className="font-mono">{b.isin_code}</span>
                    {b.issuer && <span className="text-muted-foreground truncate max-w-[120px]">{b.issuer}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {bondStats && bondStats.total_bonds > 0 && (
        <div className="grid gap-px md:grid-cols-3 bg-border/30 rounded-lg overflow-hidden animate-fade-up-delay-1">
          {Object.entries(bondStats.by_currency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([currency, count]) => (
              <div key={currency} className="bg-card p-4 grain">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-label text-muted-foreground mb-1">{currency} MK</div>
                    <div className="font-mono-data text-lg text-foreground">
                      {formatDecimal(count, 0)}
                    </div>
                  </div>
                  <Badge variant="outline">{currency}</Badge>
                </div>
              </div>
            ))}
        </div>
      )}

      <div id="tlref-charts" className="grid gap-6 lg:grid-cols-1 animate-fade-up-delay-1">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>BIST TLREF ENDEKSİ</CardDescription>
                <CardTitle className="mt-1">Tarihsel Endeks Değeri</CardTitle>
              </div>
              <Badge variant="outline">{history.length} GÜN</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <TlrefIndexChart data={indexData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-1 animate-fade-up-delay-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>GÜNLÜK ORAN DEĞİŞİMİ</CardDescription>
                <CardTitle className="mt-1">Günlük TLREF Oranı (%)</CardTitle>
              </div>
              <Badge variant="outline">HESAPLANAN</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <TlrefRateChart data={rateData} />
          </CardContent>
        </Card>
      </div>

      {history.length > 0 && (
        <Card className="animate-fade-up-delay-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>SON VERİLER</CardDescription>
                <CardTitle className="mt-1">TLREF Endeks Kayıtları</CardTitle>
              </div>
              <span className="text-label text-muted-foreground">{history.length} KAYIT</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    <th scope="col" className="pb-3 text-left text-label text-muted-foreground font-normal">
                      TARIH
                    </th>
                    <th scope="col" className="pb-3 text-right text-label text-muted-foreground font-normal">
                      ENDEKS
                    </th>
                    <th scope="col" className="pb-3 text-right text-label text-muted-foreground font-normal">
                      GUNLUK ORAN
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...history]
                    .reverse()
                    .slice(0, 50)
                    .map((r) => (
                      <tr
                        key={r.rate_date}
                        className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="py-2.5 font-mono-data text-data-sm text-foreground">
                          {formatDate(r.rate_date)}
                        </td>
                        <td className="py-2.5 text-right font-mono-data text-data-sm text-primary">
                          {formatDecimal(r.index_value, 5)}
                        </td>
                        <td className="py-2.5 text-right font-mono-data text-data-sm">
                          {r.daily_rate != null ? (
                            <span
                              className={
                                r.daily_rate >= 0 ? "text-positive" : "text-negative"
                              }
                            >
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
