"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { YieldCurveChart } from "@/components/charts/yield-curve-chart";
import { SpreadChart } from "@/components/charts/spread-chart";
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

function BondRow({ bond }: { bond: any }) {
  const [latestCalc, setLatestCalc] = useState<any>(null);
  const [price, setPrice] = useState<string>("-");

  useEffect(() => {
    const fetchCalc = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const calcResponse = await api.calculations.get(token, bond.isin_code);
        if (calcResponse && calcResponse.length > 0) {
          setLatestCalc(calcResponse[calcResponse.length - 1]);
          // Get latest market data for price
          const marketData = await api.marketData.get(token, bond.isin_code);
          if (marketData && marketData.length > 0) {
            setPrice(marketData[marketData.length - 1].clean_price?.toFixed(2) || "-");
          }
        }
      } catch (e) {
        // Skip if not available
      }
    };
    fetchCalc();
  }, [bond.isin_code]);

  return (
    <tr className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors group">
      <td className="py-3">
        <Link
          href={`/dashboard/bonds/${bond.isin_code}`}
          className="font-mono-data text-data-sm text-foreground group-hover:text-primary transition-colors"
        >
          {bond.isin_code}
        </Link>
      </td>
      <td className="py-3">
        <Badge variant={bond.bond_type === "TRT" ? "default" : "secondary"}>{bond.bond_type}</Badge>
      </td>
      <td className="py-3 font-mono-data text-data-sm text-muted-foreground">
        {new Date(bond.maturity_date).toLocaleDateString("tr-TR")}
      </td>
      <td className="py-3 text-right font-mono-data text-data-sm text-foreground">{price}</td>
      <td className="py-3 text-right font-mono-data text-data-sm text-positive">
        {latestCalc?.yield_to_maturity ? `%${parseFloat(latestCalc.yield_to_maturity).toFixed(2)}` : "-"}
      </td>
      <td className="py-3 text-right">
        {latestCalc?.spread !== null && latestCalc?.spread !== undefined ? (
          <span
            className={`font-mono-data text-data-sm ${
              parseFloat(latestCalc.spread) >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {parseFloat(latestCalc.spread) > 0 ? "+" : ""}
            {Math.round(parseFloat(latestCalc.spread))}bp
          </span>
        ) : (
          <span className="font-mono-data text-data-sm text-muted-foreground">-</span>
        )}
      </td>
    </tr>
  );
}

interface DashboardStats {
  activeBonds: number;
  avgYield: number;
  tlrefRate: number;
  avgSpread: number;
  lastUpdate: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bonds, setBonds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yieldData, setYieldData] = useState<{ maturity: string; ytm: number }[]>([]);
  const [spreadData, setSpreadData] = useState<{ date: string; spread: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const token = getToken();
      if (!token) {
        setError("Giris yapmaniz gerekiyor");
        setLoading(false);
        return;
      }

      try {
        const bondsResponse = await api.bonds.list(token, { active_only: true, limit: 100 });
        setBonds(bondsResponse.items || []);

        const tlrefResponse = await api.tlref.latest(token);
        const tlrefRate = tlrefResponse?.rate_value ? parseFloat(tlrefResponse.rate_value) : 0;

        const activeBonds = bondsResponse.items?.length || 0;

        let totalYtm = 0;
        let ytmCount = 0;
        let totalSpread = 0;
        let spreadCount = 0;

        const yieldBuckets: Record<string, number[]> = {};
        const spreadPoints: { date: string; spread: number }[] = [];

        for (const bond of (bondsResponse.items || []).slice(0, 50)) {
          try {
            const calcResponse = await api.calculations.get(token, bond.isin_code);
            if (calcResponse && calcResponse.length > 0) {
              const latestCalc = calcResponse[calcResponse.length - 1];
              if (latestCalc.yield_to_maturity) {
                const ytm = parseFloat(latestCalc.yield_to_maturity);
                totalYtm += ytm;
                ytmCount++;
                const label = maturityLabel(bond.maturity_date);
                if (!yieldBuckets[label]) yieldBuckets[label] = [];
                yieldBuckets[label].push(ytm * 100);
              }
              if (latestCalc.spread !== null && latestCalc.spread !== undefined) {
                totalSpread += parseFloat(latestCalc.spread);
                spreadCount++;
              }
              for (const c of calcResponse.slice(-30)) {
                if (c.spread != null) {
                  spreadPoints.push({
                    date: new Date(c.calc_date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
                    spread: Math.round(parseFloat(c.spread) * 10000),
                  });
                }
              }
            }
          } catch {
            /* skip */
          }
        }

        const avgYield = ytmCount > 0 ? totalYtm / ytmCount : 0;
        const avgSpread = spreadCount > 0 ? totalSpread / spreadCount : 0;

        const order = ["<6A", "6A-1Y", "1-2Y", "2-3Y", "3-5Y", "5-7Y", "7-10Y", "10Y+"];
        setYieldData(
          order
            .filter((k) => yieldBuckets[k]?.length)
            .map((k) => ({
              maturity: k,
              ytm: parseFloat((yieldBuckets[k].reduce((a, b) => a + b, 0) / yieldBuckets[k].length).toFixed(2)),
            }))
        );

        const uniqSpread = new Map<string, number>();
        for (const sp of spreadPoints) {
          if (!uniqSpread.has(sp.date)) uniqSpread.set(sp.date, sp.spread);
        }
        setSpreadData(Array.from(uniqSpread, ([date, spread]) => ({ date, spread })));

        setStats({
          activeBonds,
          avgYield,
          tlrefRate,
          avgSpread,
          lastUpdate: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        });
      } catch (err: any) {
        setError(err.message || "Veri yuklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const STATS = stats
    ? [
        { label: "AKTIF TAHVIL", value: stats.activeBonds.toString(), sub: "Takip edilen" },
        {
          label: "ORT. GETIRI (YTM)",
          value: `%${stats.avgYield.toFixed(2)}`,
          sub: "Yillik bilesik",
        },
        {
          label: "TLREF ORANI",
          value: `%${stats.tlrefRate.toFixed(2)}`,
          sub: "Borsa Istanbul",
          highlight: true,
        },
        {
          label: "ORT. SPREAD",
          value: `${Math.round(stats.avgSpread)}bp`,
          sub: "vs TLREF",
        },
      ]
    : [
        { label: "AKTIF TAHVIL", value: "0", sub: "Takip edilen" },
        { label: "ORT. GETIRI (YTM)", value: "%0.00", sub: "Yillik bilesik" },
        { label: "TLREF ORANI", value: "%0.00", sub: "Borsa Istanbul", highlight: true },
        { label: "ORT. SPREAD", value: "0bp", sub: "vs TLREF" },
      ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-display-md text-foreground">Dashboard</h1>
          <p className="text-data-sm text-muted-foreground mt-1">Turk Devlet Tahvil portfoy terminali</p>
        </div>
        <div className="flex items-center gap-2 text-label text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-positive live-indicator" />
          SON GUNCELLEME: {stats?.lastUpdate || "18:30"}
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
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className={`bg-card p-5 grain ${stat.highlight ? "amber-glow-border" : ""}`}
          >
            <div className="text-label text-muted-foreground mb-2">{stat.label}</div>
            <div className={`font-mono-data text-stat ${stat.highlight ? "text-primary" : "text-foreground"}`}>
              {stat.value}
            </div>
            <div className="text-label text-muted-foreground/60 mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 animate-fade-up-delay-1">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>GETIRI EGRISI</CardDescription>
                <CardTitle className="mt-1">Yield Curve</CardTitle>
              </div>
              <Badge variant="outline">CANLI</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <YieldCurveChart data={yieldData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>SPREAD GECMISI</CardDescription>
                <CardTitle className="mt-1">vs TLREF</CardTitle>
              </div>
              <Badge variant="outline">30G</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SpreadChart data={spreadData} />
          </CardContent>
        </Card>
      </div>

      <Card className="animate-fade-up-delay-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>PORTFOY</CardDescription>
              <CardTitle className="mt-1">Aktif Tahviller</CardTitle>
            </div>
            <span className="text-label text-muted-foreground">{bonds.length} KAYIT</span>
          </div>
        </CardHeader>
        <CardContent>
          {bonds.length === 0 && !loading ? (
            <p className="text-muted-foreground text-sm">Henuz tahvil eklenmemis.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-left text-label text-muted-foreground font-normal">ISIN KODU</th>
                    <th className="pb-3 text-left text-label text-muted-foreground font-normal">TIP</th>
                    <th className="pb-3 text-left text-label text-muted-foreground font-normal">VADE</th>
                    <th className="pb-3 text-right text-label text-muted-foreground font-normal">TEMIZ FIYAT</th>
                    <th className="pb-3 text-right text-label text-muted-foreground font-normal">YTM</th>
                    <th className="pb-3 text-right text-label text-muted-foreground font-normal">SPREAD</th>
                  </tr>
                </thead>
                <tbody>
                  {bonds.map((bond) => (
                    <BondRow key={bond.isin_code} bond={bond} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
