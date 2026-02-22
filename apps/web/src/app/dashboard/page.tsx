"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TlrefIndexChart } from "@/components/charts/tlref-index-chart";
import { TlrefRateChart } from "@/components/charts/tlref-rate-chart";
import { useTlrefHistory } from "@/hooks/use-tlref-history";
import { useUsageSummary } from "@/hooks/use-usage-summary";
import { formatDecimal, formatPercentFromDecimal, formatPercent, formatDate } from "@/lib/utils";

export default function DashboardPage() {
  useEffect(() => {
    document.title = "Dashboard — Bondley";
    return () => {
      document.title = "Bondley";
    };
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
          label: "AKTIF TAHVIL",
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
        { label: "AKTIF TAHVIL", value: "—", sub: "" },
      ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="hidden md:block">
          <h1 className="font-display text-display-md text-foreground">Dashboard</h1>
          <p className="text-data-sm text-muted-foreground mt-1">
            BIST TLREF Endeks & Borçlanma Araçları Terminali
          </p>
        </div>
        <div className="flex items-center gap-2 text-label text-muted-foreground">
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
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Veriler yukleniyor...</p>
          </CardContent>
        </Card>
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
              <div className="text-label text-muted-foreground/60 mt-1">{stat.sub}</div>
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

      {usageSummary && (
        <Card className="animate-fade-up-delay-1">
          <CardHeader>
            <CardDescription>KULLANIM ÖZETİ</CardDescription>
            <CardTitle className="mt-1">Bu ay {usageSummary.this_month_bonds_viewed} tahvil incelediniz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {usageSummary.most_viewed_bonds.length > 0 ? (
              <>
                <p className="text-label text-muted-foreground">En çok baktığınız tahviller:</p>
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
              <p className="text-data-sm text-muted-foreground">Bu dönemde henüz tahvil incelemesi yok.</p>
            )}
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
                    <div className="text-label text-muted-foreground mb-1">{currency} TAHVIL</div>
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

      <div className="grid gap-6 lg:grid-cols-1 animate-fade-up-delay-1">
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
