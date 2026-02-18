"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TlrefIndexChart } from "@/components/charts/tlref-index-chart";
import { TlrefRateChart } from "@/components/charts/tlref-rate-chart";
import { api, TLREFRecord } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

export default function AnalyticsPage() {
  const [history, setHistory] = useState<TLREFRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await api.tlref.history(token, { limit: 2000 });
        setHistory(res.items?.reverse() || []);
      } catch {
        /* skip */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Analiz verileri yukleniyor...
      </div>
    );
  }

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

  const last30 = history.slice(-30);
  const avgDailyRate =
    last30.filter((r) => r.daily_rate != null).reduce((acc, r) => acc + (r.daily_rate ?? 0), 0) /
      (last30.filter((r) => r.daily_rate != null).length || 1) *
      100;

  const minIndex = Math.min(...history.map((r) => r.index_value));
  const maxIndex = Math.max(...history.map((r) => r.index_value));
  const totalReturn =
    history.length >= 2
      ? ((history[history.length - 1].index_value - history[0].index_value) /
          history[0].index_value) *
        100
      : 0;

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">Analiz</h1>
        <p className="text-data-sm text-muted-foreground mt-1">
          BIST TLREF Endeks analiz grafikleri
        </p>
      </div>

      <div className="grid gap-px md:grid-cols-4 bg-border/30 rounded-lg overflow-hidden animate-fade-up">
        <div className="bg-card p-5 grain">
          <div className="text-label text-muted-foreground mb-2">TOPLAM GETIRI</div>
          <div className="font-mono-data text-stat text-positive">%{totalReturn.toFixed(2)}</div>
          <div className="text-label text-muted-foreground/60 mt-1">Kumulatif</div>
        </div>
        <div className="bg-card p-5 grain">
          <div className="text-label text-muted-foreground mb-2">ORT. GUNLUK</div>
          <div className="font-mono-data text-stat text-foreground">%{avgDailyRate.toFixed(4)}</div>
          <div className="text-label text-muted-foreground/60 mt-1">Son 30 gun</div>
        </div>
        <div className="bg-card p-5 grain">
          <div className="text-label text-muted-foreground mb-2">EN DUSUK</div>
          <div className="font-mono-data text-stat text-foreground">
            {minIndex.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
          </div>
          <div className="text-label text-muted-foreground/60 mt-1">Endeks</div>
        </div>
        <div className="bg-card p-5 grain">
          <div className="text-label text-muted-foreground mb-2">EN YUKSEK</div>
          <div className="font-mono-data text-stat text-foreground">
            {maxIndex.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
          </div>
          <div className="text-label text-muted-foreground/60 mt-1">Endeks</div>
        </div>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>BIST TLREF ENDEKSI</CardDescription>
              <CardTitle className="mt-1">Tarihsel Endeks Grafigi</CardTitle>
            </div>
            <Badge variant="outline">{history.length} GUN</Badge>
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
              <CardDescription>GUNLUK ORAN DEGISIMI</CardDescription>
              <CardTitle className="mt-1">Gunluk TLREF Orani (%)</CardTitle>
            </div>
            <Badge variant="outline">SON 90 GUN</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <TlrefRateChart data={rateData} />
        </CardContent>
      </Card>
    </div>
  );
}
