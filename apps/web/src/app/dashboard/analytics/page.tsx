"use client";

import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TlrefIndexChart } from "@/components/charts/tlref-index-chart";
import { TlrefRateChart } from "@/components/charts/tlref-rate-chart";
import { useTlrefHistory } from "@/hooks/use-tlref-history";
import { formatDecimal, formatPercent } from "@/lib/utils";

function periodReturn(
  rows: Array<{ rate_date: string; index_value: number }>,
  startDate: Date,
): number | null {
  const selected = rows.filter((row) => new Date(row.rate_date) >= startDate);
  if (selected.length < 2 || selected[0].index_value <= 0) return null;
  return (
    ((selected.at(-1)!.index_value - selected[0].index_value) /
      selected[0].index_value) *
    100
  );
}

export default function AnalyticsPage() {
  useEffect(() => {
    document.title = "Analiz — Bondley";
  }, []);
  const { history, indexData, rateData, stats, bondStats, loading, error } = useTlrefHistory();

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Doğrulanmış seriler yükleniyor…</div>;
  }

  const validHistory = history.filter((row) => row.index_value > 0);
  const latest = validHistory.at(-1);
  const latestDate = latest ? new Date(`${latest.rate_date}T12:00:00`) : new Date();
  const yearStart = new Date(latestDate.getFullYear(), 0, 1);
  const threeMonthsAgo = new Date(latestDate);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const ytd = periodReturn(validHistory, yearStart);
  const threeMonth = periodReturn(validHistory, threeMonthsAgo);
  const sortedSecurityTypes = Object.entries(bondStats?.by_security_type || {}).sort(([, a], [, b]) => b - a);
  const sortedYieldTypes = Object.entries(bondStats?.by_yield_type || {}).sort(([, a], [, b]) => b - a);

  return (
    <main className="space-y-8">
      <header>
        <h1 className="text-display-md">Doğrulanmış piyasa analizi</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          BIST’in yayımladığı TLREF endeks ve yıllık oran serileri. Kullanıcı fiyatı olmadan getiri eğrisi üretilmez.
        </p>
      </header>

      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Yıl başından getiri", ytd == null ? "—" : formatPercent(ytd), "Endeks değişimi"],
          ["Son 3 ay getiri", threeMonth == null ? "—" : formatPercent(threeMonth), "Endeks değişimi"],
          ["Yayımlanan yıllık TLREF", stats?.latest_annual_rate == null ? "—" : formatPercent(stats.latest_annual_rate), stats?.latest_date || "—"],
          ["Aktif seri kaydı", formatDecimal(history.length, 0), "Doğrulanmış gözlem"],
        ].map(([label, value, sub]) => (
          <Card key={label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent>
              <div className="font-mono-data text-2xl font-bold">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardDescription>TLREF endeksi</CardDescription>
              <CardTitle className="mt-1">Tarihsel endeks değeri</CardTitle>
            </div>
            <Badge variant="outline">{history.length} iş günü</Badge>
          </div>
        </CardHeader>
        <CardContent><TlrefIndexChart data={indexData} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Resmî oran serisi</CardDescription>
          <CardTitle className="mt-1">BIST yayımlanan yıllık TLREF oranı</CardTitle>
        </CardHeader>
        <CardContent><TlrefRateChart data={rateData} /></CardContent>
      </Card>

      {bondStats && bondStats.total_bonds > 0 && (
        <section className="space-y-5">
          <h2 className="text-display-sm">Kıymet dağılımları</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              ["Kıymet türü", sortedSecurityTypes],
              ["Getiri türü", sortedYieldTypes],
            ].map(([title, rows]) => (
              <Card key={title as string}>
                <CardHeader><CardTitle className="text-base">{title as string}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {(rows as Array<[string, number]>).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between border-b py-3 last:border-0">
                        <span className="max-w-[70%] truncate text-sm text-muted-foreground">{name.split("/")[0].trim()}</span>
                        <span className="font-mono-data text-sm">
                          {count} · %{((count / bondStats.total_bonds) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
