"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { YieldCurveChart } from "@/components/charts/yield-curve-chart";
import { SpreadChart } from "@/components/charts/spread-chart";

const STATS = [
  { label: "AKTIF TAHVIL", value: "24", sub: "Takip edilen" },
  { label: "ORT. GETIRI (YTM)", value: "%28.47", sub: "Yillik bilesik" },
  { label: "TLREF ORANI", value: "%36.72", sub: "Borsa Istanbul", highlight: true },
  { label: "ORT. SPREAD", value: "156bp", sub: "vs TLREF" },
];

const BONDS = [
  { isin: "TRT060127T10", type: "TRT", maturity: "2027-01-06", cleanPrice: "98.450", ytm: "30.12", spread: 145 },
  { isin: "TRT150228T18", type: "TRT", maturity: "2028-02-15", cleanPrice: "95.230", ytm: "32.45", spread: 178 },
  { isin: "TRB100326T12", type: "TRB", maturity: "2026-03-10", cleanPrice: "101.20", ytm: "27.56", spread: -12 },
  { isin: "TRT220630T14", type: "TRT", maturity: "2030-06-22", cleanPrice: "89.870", ytm: "35.67", spread: 234 },
  { isin: "TRT051229T16", type: "TRT", maturity: "2029-12-05", cleanPrice: "91.450", ytm: "33.89", spread: 198 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-display-md text-foreground">Dashboard</h1>
          <p className="text-data-sm text-muted-foreground mt-1">Turk Devlet Tahvil portfoy terminali</p>
        </div>
        <div className="flex items-center gap-2 text-label text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-positive live-indicator" />
          SON GUNCELLEME: 18:30
        </div>
      </div>

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
            <YieldCurveChart />
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
            <SpreadChart />
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
            <span className="text-label text-muted-foreground">{BONDS.length} KAYIT</span>
          </div>
        </CardHeader>
        <CardContent>
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
                {BONDS.map((bond) => (
                  <tr
                    key={bond.isin}
                    className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors group"
                  >
                    <td className="py-3">
                      <Link
                        href={`/dashboard/bonds/${bond.isin}`}
                        className="font-mono-data text-data-sm text-foreground group-hover:text-primary transition-colors"
                      >
                        {bond.isin}
                      </Link>
                    </td>
                    <td className="py-3">
                      <Badge variant={bond.type === "TRT" ? "default" : "secondary"}>{bond.type}</Badge>
                    </td>
                    <td className="py-3 font-mono-data text-data-sm text-muted-foreground">{bond.maturity}</td>
                    <td className="py-3 text-right font-mono-data text-data-sm text-foreground">{bond.cleanPrice}</td>
                    <td className="py-3 text-right font-mono-data text-data-sm text-positive">%{bond.ytm}</td>
                    <td className="py-3 text-right">
                      <span className={`font-mono-data text-data-sm ${bond.spread >= 0 ? "text-positive" : "text-negative"}`}>
                        {bond.spread > 0 ? "+" : ""}{bond.spread}bp
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
