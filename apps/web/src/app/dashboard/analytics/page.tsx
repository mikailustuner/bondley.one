"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { YieldCurveChart } from "@/components/charts/yield-curve-chart";
import { SpreadChart } from "@/components/charts/spread-chart";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

function maturityLabel(matDate: string): string {
  const diff = (new Date(matDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365.25);
  if (diff <= 0.5) return "<6A";
  if (diff <= 1) return "6A-1Y";
  if (diff <= 2) return "1-2Y";
  if (diff <= 3) return "2-3Y";
  if (diff <= 5) return "3-5Y";
  if (diff <= 7) return "5-7Y";
  if (diff <= 10) return "7-10Y";
  return "10Y+";
}

export default function AnalyticsPage() {
  const [yieldData, setYieldData] = useState<{ maturity: string; ytm: number }[]>([]);
  const [spreadData, setSpreadData] = useState<{ date: string; spread: number }[]>([]);
  const [priceData, setPriceData] = useState<{ date: string; clean: number; dirty: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const bondsRes = await api.bonds.list(token, { active_only: true, limit: 3000 });
        const bonds = bondsRes.items || [];

        const yieldBuckets: Record<string, number[]> = {};
        const spreadPoints: { date: string; spread: number }[] = [];
        let sampleIsin: string | null = null;

        for (const bond of bonds.slice(0, 50)) {
          try {
            const calcs = await api.calculations.get(token, bond.isin_code);
            if (!calcs?.length) continue;

            const latest = calcs[calcs.length - 1];
            const ytm = parseFloat(latest.yield_to_maturity) * 100;
            const label = maturityLabel(bond.maturity_date);
            if (!yieldBuckets[label]) yieldBuckets[label] = [];
            yieldBuckets[label].push(ytm);

            if (latest.spread != null) {
              for (const c of calcs.slice(-30)) {
                if (c.spread != null) {
                  spreadPoints.push({
                    date: new Date(c.calc_date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
                    spread: Math.round(parseFloat(c.spread) * 10000),
                  });
                }
              }
            }

            if (!sampleIsin) sampleIsin = bond.isin_code;
          } catch {
            /* skip */
          }
        }

        const order = ["<6A", "6A-1Y", "1-2Y", "2-3Y", "3-5Y", "5-7Y", "7-10Y", "10Y+"];
        const yieldCurve = order
          .filter((k) => yieldBuckets[k]?.length)
          .map((k) => ({
            maturity: k,
            ytm: parseFloat((yieldBuckets[k].reduce((a, b) => a + b, 0) / yieldBuckets[k].length).toFixed(2)),
          }));
        setYieldData(yieldCurve);

        const uniqueSpreads = new Map<string, number>();
        for (const sp of spreadPoints) {
          if (!uniqueSpreads.has(sp.date)) uniqueSpreads.set(sp.date, sp.spread);
        }
        setSpreadData(Array.from(uniqueSpreads, ([date, spread]) => ({ date, spread })));

        if (sampleIsin) {
          try {
            const md = await api.marketData.get(token, sampleIsin);
            if (md?.length) {
              const calcs = await api.calculations.get(token, sampleIsin);
              const calcMap = new Map<string, any>();
              if (calcs) for (const c of calcs) calcMap.set(c.calc_date, c);

              const history = md
                .slice()
                .reverse()
                .slice(-60)
                .map((m: any) => {
                  const c = calcMap.get(m.trade_date);
                  return {
                    date: new Date(m.trade_date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
                    clean: parseFloat(m.clean_price),
                    dirty: c ? parseFloat(c.dirty_price) : parseFloat(m.clean_price),
                  };
                });
              setPriceData(history);
            }
          } catch {
            /* skip */
          }
        }
      } catch {
        /* skip */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">Analiz verileri yukleniyor...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">Analiz</h1>
        <p className="text-data-sm text-muted-foreground mt-1">Tahvil piyasasi analiz grafikleri</p>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>GETIRI EGRISI</CardDescription>
              <CardTitle className="mt-1">Yield Curve — TRT Tahvilleri</CardTitle>
            </div>
            <Badge variant="outline">TUM VADELER</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <YieldCurveChart data={yieldData} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 animate-fade-up-delay-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>SPREAD TRENDI</CardDescription>
                <CardTitle className="mt-1">vs TLREF</CardTitle>
              </div>
              <Badge variant="outline">30G</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SpreadChart data={spreadData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>FIYAT KARSILASTIRMASI</CardDescription>
                <CardTitle className="mt-1">Temiz / Kirli Fiyat</CardTitle>
              </div>
              <Badge variant="outline">6A</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <PriceHistoryChart data={priceData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
