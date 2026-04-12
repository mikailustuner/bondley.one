"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TlrefIndexChart } from "@/components/charts/tlref-index-chart";
import { TlrefRateChart } from "@/components/charts/tlref-rate-chart";
import { useTlrefHistory } from "@/hooks/use-tlref-history";
import { formatDecimal, formatPercent } from "@/lib/utils";

export default function AnalyticsPage() {
  useEffect(() => {
    document.title = "Analiz — Bondley";
    return () => {
      document.title = "Bondley";
    };
  }, []);
  const { history, indexData, rateData, bondStats, loading } = useTlrefHistory();

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-[15px]">
        Analiz verileri yükleniyor...
      </div>
    );
  }

  const last30 = history.slice(-30);
  const dailyRates = last30.filter((r) => r.daily_rate != null);
  const avgDailyRatePct =
    dailyRates.length > 0
      ? (dailyRates.reduce((acc, r) => acc + (r.daily_rate ?? 0), 0) / dailyRates.length) * 100
      : null;

  const minIndex = history.length ? Math.min(...history.map((r) => r.index_value)) : null;
  const maxIndex = history.length ? Math.max(...history.map((r) => r.index_value)) : null;
  const totalReturnPct =
    history.length >= 2
      ? ((history[history.length - 1].index_value - history[0].index_value) /
        history[0].index_value) *
      100
      : null;

  const sortedSecTypes = bondStats
    ? Object.entries(bondStats.by_security_type).sort(([, a], [, b]) => b - a)
    : [];
  const sortedYieldTypes = bondStats
    ? Object.entries(bondStats.by_yield_type).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-display-md text-foreground">Analiz</h1>
        <p className="text-[15px] text-muted-foreground mt-1.5">
          BIST TLREF Endeks & Borçlanma Araçları Dağılım Analizi
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 animate-fade-up">
        {[
          { label: "Toplam Getiri", value: totalReturnPct != null ? formatPercent(totalReturnPct) : "—", sub: "Kümülatif", highlight: true },
          { label: "Ort. Günlük", value: avgDailyRatePct != null ? formatPercent(avgDailyRatePct) : "—", sub: "Son 30 gün" },
          { label: "En Düşük", value: minIndex != null ? formatDecimal(minIndex, 2) : "—", sub: "Endeks" },
          { label: "En Yüksek", value: maxIndex != null ? formatDecimal(maxIndex, 2) : "—", sub: "Endeks" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-3xl border border-border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[13px] font-medium text-muted-foreground mb-2">{stat.label}</div>
            <div className={`font-mono-data text-stat ${stat.highlight ? "text-positive" : "text-foreground"}`}>
              {stat.value}
            </div>
            <div className="text-[13px] text-muted-foreground mt-1.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>BIST TLREF Endeksi</CardDescription>
              <CardTitle className="mt-1">Tarihsel Endeks Grafiği</CardTitle>
            </div>
            <Badge variant="outline">{history.length} Gün</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <TlrefIndexChart data={indexData} />
        </CardContent>
      </Card>

      <Card className="animate-fade-up-delay-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>Günlük Oran Değişimi</CardDescription>
              <CardTitle className="mt-1">Günlük TLREF Oranı (%)</CardTitle>
            </div>
            <Badge variant="outline">Son 90 Gün</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <TlrefRateChart data={rateData} />
        </CardContent>
      </Card>

      {/* Distribution Analysis */}
      {bondStats && bondStats.total_bonds > 0 && (
        <>
          <div className="animate-fade-up-delay-2">
            <h2 className="text-display-sm text-foreground mb-6">
              Borçlanma Araçları Dağılım Analizi
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 animate-fade-up-delay-2">
            <Card>
              <CardHeader>
                <CardDescription>Araç Türüne Göre</CardDescription>
                <CardTitle className="mt-1">Menkul Kıymet Türü Dağılımı</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {sortedSecTypes.map(([type, count]) => {
                    const pct =
                      bondStats.total_bonds > 0
                        ? formatDecimal((count / bondStats.total_bonds) * 100, 1)
                        : "0";
                    const shortName = type.split("/")[0].trim();
                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between py-3.5 border-b border-border/30 last:border-0"
                      >
                        <span className="text-[13px] text-muted-foreground max-w-[60%] truncate">
                          {shortName}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min((count / bondStats.total_bonds) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono-data text-[13px] text-foreground w-16 text-right">
                            {count} ({pct}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Getiri Türüne Göre</CardDescription>
                <CardTitle className="mt-1">Getiri Türü Dağılımı</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {sortedYieldTypes.map(([type, count]) => {
                    const pct =
                      bondStats.total_bonds > 0
                        ? formatDecimal((count / bondStats.total_bonds) * 100, 1)
                        : "0";
                    const shortName = type.split("/")[0].trim();
                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between py-3.5 border-b border-border/30 last:border-0"
                      >
                        <span className="text-[13px] text-muted-foreground max-w-[60%] truncate">
                          {shortName}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min((count / bondStats.total_bonds) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono-data text-[13px] text-foreground w-16 text-right">
                            {count} ({pct}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="animate-fade-up-delay-2">
            <CardHeader>
              <CardDescription>Para Birimine Göre</CardDescription>
              <CardTitle className="mt-1">Döviz Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                {Object.entries(bondStats.by_currency)
                  .sort(([, a], [, b]) => b - a)
                  .map(([currency, count]) => (
                    <div key={currency} className="bg-secondary/30 rounded-xl p-4">
                      <div className="text-[13px] text-muted-foreground mb-1.5">{currency}</div>
                      <div className="font-mono-data text-xl text-foreground">
                        {formatDecimal(count, 0)}
                      </div>
                      <div className="text-[13px] text-muted-foreground mt-1">
                        {bondStats.total_bonds > 0
                          ? formatPercent((count / bondStats.total_bonds) * 100)
                          : "—"}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
