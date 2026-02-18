"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const BONDS = [
  { isin: "TRT060127T10", type: "TRT" as const, maturity: "2027-01-06", coupon: "0.15", cleanPrice: "98.450", ytm: "30.12", duration: "1.856" },
  { isin: "TRT150228T18", type: "TRT" as const, maturity: "2028-02-15", coupon: "0.12", cleanPrice: "95.230", ytm: "32.45", duration: "2.742" },
  { isin: "TRB100326T12", type: "TRB" as const, maturity: "2026-03-10", coupon: "0.08", cleanPrice: "101.20", ytm: "27.56", duration: "0.945" },
  { isin: "TRT220630T14", type: "TRT" as const, maturity: "2030-06-22", coupon: "0.18", cleanPrice: "89.870", ytm: "35.67", duration: "4.213" },
  { isin: "TRT051229T16", type: "TRT" as const, maturity: "2029-12-05", coupon: "0.16", cleanPrice: "91.450", ytm: "33.89", duration: "3.678" },
  { isin: "TRT230731T20", type: "TRT" as const, maturity: "2031-07-23", coupon: "0.20", cleanPrice: "87.120", ytm: "37.12", duration: "5.124" },
];

export default function BondsListPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display text-display-md text-foreground">Tahviller</h1>
          <p className="text-data-sm text-muted-foreground mt-1">Tum aktif Turk Devlet Tahvilleri</p>
        </div>
        <div className="w-64">
          <Input placeholder="ISIN ile ara..." className="font-mono-data" />
        </div>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>PORTFOY</CardDescription>
              <CardTitle className="mt-1">Tahvil Listesi</CardTitle>
            </div>
            <span className="text-label text-muted-foreground">{BONDS.length} KAYIT</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["ISIN KODU", "TIP", "VADE", "KUPON", "TEMIZ FIYAT", "YTM", "DURASYON"].map((h, i) => (
                    <th
                      key={h}
                      className={`pb-3 text-label text-muted-foreground font-normal ${i >= 4 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
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
                    <td className="py-3 font-mono-data text-data-sm text-foreground">
                      %{(parseFloat(bond.coupon) * 100).toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-mono-data text-data-sm text-foreground">{bond.cleanPrice}</td>
                    <td className="py-3 text-right font-mono-data text-data-sm text-positive">%{bond.ytm}</td>
                    <td className="py-3 text-right font-mono-data text-data-sm text-muted-foreground">{bond.duration}</td>
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
