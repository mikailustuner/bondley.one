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
      <div className="py-12 text-center text-muted-foreground text-sm">
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
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">Analiz</h1>
        <p className="text-data-sm text-muted-foreground mt-1">
          BIST TLREF Endeks & Borçlanma Araçları Dağılım Analizi
        </p>
      </div>

      <div className="grid gap-px md:grid-cols-4 bg-border/30 rounded-lg overflow-hidden animate-fade-up">
        <div className="bg-card p-5 grain">
          <div className="text-label text-muted-foreground mb-2">TOPLAM GETIRI</div>
          <div className="font-mono-data text-stat text-positive">
            {totalReturnPct != null ? formatPercent(totalReturnPct) : "—"}
          </div>
          <div className="text-label text-muted-foreground mt-1">Kumulatif</div>
        </div>
        <div className="bg-card p-5 grain">
          <div className="text-label text-muted-foreground mb-2">ORT. GUNLUK</div>
          <div className="font-mono-data text-stat text-foreground">
            {avgDailyRatePct != null ? formatPercent(avgDailyRatePct) : "—"}
          </div>
          <div className="text-label text-muted-foreground mt-1">Son 30 gün</div>
        </div>
        <div className="bg-card p-5 grain">
          <div className="text-label text-muted-foreground mb-2">EN DUSUK</div>
          <div className="font-mono-data text-stat text-foreground">
            {minIndex != null ? formatDecimal(minIndex, 2) : "—"}
          </div>
          <div className="text-label text-muted-foreground mt-1">Endeks</div>
        </div>
        <div className="bg-card p-5 grain">
          <div className="text-label text-muted-foreground mb-2">EN YUKSEK</div>
          <div className="font-mono-data text-stat text-foreground">
            {maxIndex != null ? formatDecimal(maxIndex, 2) : "—"}
          </div>
          <div className="text-label text-muted-foreground mt-1">Endeks</div>
        </div>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>BIST TLREF ENDEKSİ</CardDescription>
              <CardTitle className="mt-1">Tarihsel Endeks Grafiği</CardTitle>
            </div>
            <Badge variant="outline">{history.length} GÜN</Badge>
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
              <CardDescription>GÜNLÜK ORAN DEĞİŞİMİ</CardDescription>
              <CardTitle className="mt-1">Günlük TLREF Oranı (%)</CardTitle>
            </div>
            <Badge variant="outline">SON 90 GUN</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <TlrefRateChart data={rateData} />
        </CardContent>
      </Card>

      {bondStats && bondStats.total_bonds > 0 && (
        <>
          <div className="animate-fade-up-delay-2">
            <h2 className="font-display text-display-sm text-foreground mb-4">
              Borçlanma Araçları Dağılım Analizi
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 animate-fade-up-delay-2">
            <Card>
              <CardHeader>
                <CardDescription>MK TÜRÜNE GÖRE</CardDescription>
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
                        className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0"
                      >
                        <span className="text-data-sm text-muted-foreground max-w-[60%] truncate">
                          {shortName}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-secondary/50 rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{
                                width: `${Math.min((count / bondStats.total_bonds) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono-data text-data-sm text-foreground w-16 text-right">
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
                <CardDescription>GETİRİ TÜRÜNE GÖRE</CardDescription>
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
                        className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0"
                      >
                        <span className="text-data-sm text-muted-foreground max-w-[60%] truncate">
                          {shortName}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-secondary/50 rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{
                                width: `${Math.min((count / bondStats.total_bonds) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono-data text-data-sm text-foreground w-16 text-right">
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
              <CardDescription>PARA BİRİMİNE GÖRE</CardDescription>
              <CardTitle className="mt-1">Döviz Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-px md:grid-cols-4 bg-border/30 rounded-lg overflow-hidden">
                {Object.entries(bondStats.by_currency)
                  .sort(([, a], [, b]) => b - a)
                  .map(([currency, count]) => (
                    <div key={currency} className="bg-card p-4">
                      <div className="text-label text-muted-foreground mb-1">{currency}</div>
                      <div className="font-mono-data text-lg text-foreground">
                        {formatDecimal(count, 0)}
                      </div>
                      <div className="text-label text-muted-foreground">
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
