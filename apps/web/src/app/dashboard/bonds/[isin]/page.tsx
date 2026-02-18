"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";

export default function BondDetailPage({ params }: { params: { isin: string } }) {
  const { isin } = params;

  const bond = {
    isin_code: isin,
    bond_type: isin.startsWith("TRT") ? "TRT" : "TRB",
    issue_date: "2024-01-06",
    maturity_date: "2027-01-06",
    coupon_rate: "0.150000",
    face_value: "100.00",
    clean_price: "98.450000",
    dirty_price: "99.672345",
    accrued_interest: "1.222345",
    ytm: "0.301200",
    spread: "0.014500",
    macaulay_duration: "1.856000",
    modified_duration: "1.612000",
  };

  const metrics = [
    { label: "TEMIZ FIYAT", value: parseFloat(bond.clean_price).toFixed(4), mono: true },
    { label: "KIRLI FIYAT", value: parseFloat(bond.dirty_price).toFixed(4), mono: true },
    { label: "YTM (GETIRI)", value: `%${(parseFloat(bond.ytm) * 100).toFixed(2)}`, highlight: true },
    { label: "SPREAD", value: `${(parseFloat(bond.spread) * 10000).toFixed(0)}bp`, positive: true },
  ];

  const details = [
    ["Kupon Orani", `%${(parseFloat(bond.coupon_rate) * 100).toFixed(2)}`],
    ["Nominal Deger", bond.face_value],
    ["Birikmis Faiz", parseFloat(bond.accrued_interest).toFixed(6)],
    ["Kirli Fiyat", parseFloat(bond.dirty_price).toFixed(6)],
    ["Ic Verim Orani (IRR)", `%${(parseFloat(bond.ytm) * 100).toFixed(4)}`],
    ["Spread vs TLREF", `${(parseFloat(bond.spread) * 10000).toFixed(2)} bp`],
    ["Macaulay Durasyon", `${bond.macaulay_duration} yil`],
    ["Modifiye Durasyon", `${bond.modified_duration} yil`],
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
            Ihrac: {bond.issue_date} &middot; Vade: {bond.maturity_date}
          </p>
        </div>
        <Button>Hesaplama Calistir</Button>
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
            <PriceHistoryChart />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardDescription>HESAPLAMA SONUCLARI</CardDescription>
            <CardTitle className="mt-1">Detay Bilgiler</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
