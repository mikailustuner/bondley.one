"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TlrefIndexChart } from "@/components/charts/tlref-index-chart";
import { TlrefRateChart } from "@/components/charts/tlref-rate-chart";
import { api, TLREFRecord, TLREFStats, BondStats } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

export default function DashboardPage() {
  const [stats, setStats] = useState<TLREFStats | null>(null);
  const [bondStats, setBondStats] = useState<BondStats | null>(null);
  const [history, setHistory] = useState<TLREFRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const token = getToken();
      if (!token) {
        setError("Giris yapmaniz gerekiyor");
        setLoading(false);
        return;
      }

      try {
        const [statsRes, historyRes, bondStatsRes] = await Promise.all([
          api.tlref.stats(token),
          api.tlref.history(token, { limit: 2000 }),
          api.bonds.stats(token).catch(() => null),
        ]);

        setStats(statsRes);
        setHistory(historyRes.items?.reverse() || []);
        if (bondStatsRes) setBondStats(bondStatsRes);
      } catch (err: any) {
        setError(err.message || "Veri yuklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const indexData = history.map((r) => ({
    date: new Date(r.rate_date).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }),
    value: r.index_value,
  }));

  const rateData = history
    .filter((r) => r.daily_rate != null)
    .map((r) => ({
      date: new Date(r.rate_date).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }),
      rate: +(r.daily_rate! * 100).toFixed(6),
    }));

  const STATS = stats
    ? [
        {
          label: "TLREF ENDEKS",
          value: stats.latest_index.toLocaleString("tr-TR", { maximumFractionDigits: 2 }),
          sub: stats.latest_date
            ? new Date(stats.latest_date).toLocaleDateString("tr-TR")
            : "",
          highlight: true,
        },
        {
          label: "GUNLUK ORAN",
          value:
            stats.latest_daily_rate != null ? `%${stats.latest_daily_rate.toFixed(4)}` : "—",
          sub: "Son is gunu",
        },
        {
          label: "YILLIK ORAN",
          value:
            stats.annualized_rate_pct != null
              ? `%${stats.annualized_rate_pct.toFixed(2)}`
              : "—",
          sub: "Bilesik yillik",
        },
        {
          label: "AKTIF TAHVIL",
          value: bondStats
            ? bondStats.total_bonds.toLocaleString("tr-TR")
            : "—",
          sub: bondStats?.avg_days_to_maturity
            ? `Ort. vade: ${Math.round(bondStats.avg_days_to_maturity)} gun`
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
        <div>
          <h1 className="font-display text-display-md text-foreground">Dashboard</h1>
          <p className="text-data-sm text-muted-foreground mt-1">
            BIST TLREF Endeks & Borclanma Araclari Terminali
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
                      {count.toLocaleString("tr-TR")}
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
                <CardDescription>BIST TLREF ENDEKSI</CardDescription>
                <CardTitle className="mt-1">Tarihsel Endeks Degeri</CardTitle>
              </div>
              <Badge variant="outline">{history.length} GUN</Badge>
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
                <CardDescription>GUNLUK ORAN DEGISIMI</CardDescription>
                <CardTitle className="mt-1">Gunluk TLREF Orani (%)</CardTitle>
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
                <CardDescription>SON VERILER</CardDescription>
                <CardTitle className="mt-1">TLREF Endeks Kayitlari</CardTitle>
              </div>
              <span className="text-label text-muted-foreground">{history.length} KAYIT</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    <th className="pb-3 text-left text-label text-muted-foreground font-normal">
                      TARIH
                    </th>
                    <th className="pb-3 text-right text-label text-muted-foreground font-normal">
                      ENDEKS
                    </th>
                    <th className="pb-3 text-right text-label text-muted-foreground font-normal">
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
                          {new Date(r.rate_date).toLocaleDateString("tr-TR")}
                        </td>
                        <td className="py-2.5 text-right font-mono-data text-data-sm text-primary">
                          {r.index_value.toLocaleString("tr-TR", {
                            maximumFractionDigits: 5,
                          })}
                        </td>
                        <td className="py-2.5 text-right font-mono-data text-data-sm">
                          {r.daily_rate != null ? (
                            <span
                              className={
                                r.daily_rate >= 0 ? "text-positive" : "text-negative"
                              }
                            >
                              %{(r.daily_rate * 100).toFixed(5)}
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
