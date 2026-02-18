"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

interface BondData {
  id: number;
  isin_code: string;
  bond_type: string;
  issue_date: string;
  maturity_date: string;
  coupon_rate: string;
  face_value: string;
  is_active: boolean;
}

interface CalcData {
  dirty_price: string;
  accrued_interest: string;
  yield_to_maturity: string;
  spread: string | null;
  modified_duration: string | null;
  macaulay_duration: string | null;
}

export default function BondDetailPage({ params }: { params: { isin: string } }) {
  const { isin } = params;
  const [bond, setBond] = useState<BondData | null>(null);
  const [calc, setCalc] = useState<CalcData | null>(null);
  const [cleanPrice, setCleanPrice] = useState<number | null>(null);
  const [priceHistory, setPriceHistory] = useState<{ date: string; clean: number; dirty: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  async function fetchData() {
    const token = getToken();
    if (!token) {
      setError("Giris yapmaniz gerekiyor");
      setLoading(false);
      return;
    }
    try {
      const bondRes = await api.bonds.get(token, isin);
      setBond(bondRes);

      const calcs = await api.calculations.get(token, isin);
      if (calcs?.length) {
        setCalc(calcs[calcs.length - 1]);
      }

      const md = await api.marketData.get(token, isin, { limit: 180 } as any);
      if (md?.length) {
        setCleanPrice(parseFloat(md[md.length - 1].clean_price));

        const history = md
          .slice()
          .reverse()
          .map((m: any) => ({
            date: new Date(m.trade_date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
            clean: parseFloat(m.clean_price),
            dirty: parseFloat(m.clean_price) * 1.012,
          }));
        setPriceHistory(history);

        if (calcs?.length) {
          const calcMap = new Map<string, any>();
          for (const c of calcs) calcMap.set(c.calc_date, c);
          const enriched = md
            .slice()
            .reverse()
            .map((m: any) => {
              const c = calcMap.get(m.trade_date);
              return {
                date: new Date(m.trade_date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
                clean: parseFloat(m.clean_price),
                dirty: c ? parseFloat(c.dirty_price) : parseFloat(m.clean_price) * 1.012,
              };
            });
          setPriceHistory(enriched);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Veri yuklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [isin]);

  async function handleRun() {
    if (!bond) return;
    const token = getToken();
    if (!token) return;
    setRunning(true);
    setRunMsg(null);
    try {
      await api.calculations.run(token, bond.id);
      setRunMsg("Hesaplama tamamlandi");
      setLoading(true);
      await fetchData();
    } catch (e: any) {
      setRunMsg(e?.message || "Hesaplama basarisiz");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">Yukleniyor...</div>
    );
  }
  if (error) {
    return (
      <div className="py-12 text-center text-destructive text-sm">{error}</div>
    );
  }
  if (!bond) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">Tahvil bulunamadi</div>
    );
  }

  const cp = cleanPrice ?? 0;
  const dp = calc ? parseFloat(calc.dirty_price) : 0;
  const ai = calc ? parseFloat(calc.accrued_interest) : 0;
  const ytm = calc ? parseFloat(calc.yield_to_maturity) : 0;
  const spread = calc?.spread != null ? parseFloat(calc.spread) : null;
  const macD = calc?.macaulay_duration ? parseFloat(calc.macaulay_duration) : null;
  const modD = calc?.modified_duration ? parseFloat(calc.modified_duration) : null;
  const coupon = parseFloat(bond.coupon_rate);

  const metrics = [
    { label: "TEMIZ FIYAT", value: cp.toFixed(4), mono: true },
    { label: "KIRLI FIYAT", value: dp.toFixed(4), mono: true },
    { label: "YTM (GETIRI)", value: `%${(ytm * 100).toFixed(2)}`, highlight: true },
    {
      label: "SPREAD",
      value: spread != null ? `${(spread * 10000).toFixed(0)}bp` : "-",
      positive: spread != null && spread >= 0,
    },
  ];

  const details = [
    ["Kupon Orani", `%${(coupon * 100).toFixed(2)}`],
    ["Nominal Deger", bond.face_value],
    ["Birikmis Faiz", ai.toFixed(6)],
    ["Kirli Fiyat", dp.toFixed(6)],
    ["Ic Verim Orani (IRR)", `%${(ytm * 100).toFixed(4)}`],
    ["Spread vs TLREF", spread != null ? `${(spread * 10000).toFixed(2)} bp` : "-"],
    ["Macaulay Durasyon", macD != null ? `${macD.toFixed(4)} yil` : "-"],
    ["Modifiye Durasyon", modD != null ? `${modD.toFixed(4)} yil` : "-"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/bonds" className="text-data-sm text-muted-foreground hover:text-primary transition-colors">
              Tahviller
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <h1 className="font-mono-data text-display-md text-foreground">{bond.isin_code}</h1>
            <Badge variant={bond.bond_type === "TRT" ? "default" : "secondary"}>{bond.bond_type}</Badge>
          </div>
          <p className="text-data-sm text-muted-foreground mt-1">
            Ihrac: {new Date(bond.issue_date).toLocaleDateString("tr-TR")} &middot; Vade: {new Date(bond.maturity_date).toLocaleDateString("tr-TR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {runMsg && <span className="text-data-sm text-muted-foreground">{runMsg}</span>}
          <Button onClick={handleRun} disabled={running}>
            {running ? "Hesaplaniyor..." : "Hesaplama Calistir"}
          </Button>
        </div>
      </div>

      <div className="grid gap-px md:grid-cols-4 bg-border/30 rounded-lg overflow-hidden animate-fade-up-delay-1">
        {metrics.map((m) => (
          <div key={m.label} className={`bg-card p-5 grain ${m.highlight ? "amber-glow-border" : ""}`}>
            <div className="text-label text-muted-foreground mb-2">{m.label}</div>
            <div className={`font-mono-data text-stat ${m.highlight ? "text-primary" : m.positive ? "text-positive" : "text-foreground"}`}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5 animate-fade-up-delay-2">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardDescription>FIYAT GECMISI</CardDescription>
            <CardTitle className="mt-1">Temiz &amp; Kirli Fiyat</CardTitle>
          </CardHeader>
          <CardContent>
            {priceHistory.length > 0 ? (
              <PriceHistoryChart data={priceHistory} />
            ) : (
              <p className="text-data-sm text-muted-foreground py-8 text-center">Fiyat gecmisi bulunmuyor</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardDescription>HESAPLAMA SONUCLARI</CardDescription>
            <CardTitle className="mt-1">Detay Bilgiler</CardTitle>
          </CardHeader>
          <CardContent>
            {calc ? (
              <div className="space-y-0">
                {details.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between items-center py-2.5 border-b border-border/30 last:border-0"
                  >
                    <span className="text-data-sm text-muted-foreground">{label}</span>
                    <span className="font-mono-data text-data-sm text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-data-sm text-muted-foreground py-8 text-center">
                Hesaplama sonucu bulunmuyor. &quot;Hesaplama Calistir&quot; butonunu kullanin.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
