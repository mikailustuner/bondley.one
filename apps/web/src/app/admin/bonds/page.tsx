"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const BONDS_DATA = [
  { isin: "TRT060127T10", type: "TRT" as const, issue: "2024-01-06", maturity: "2027-01-06", coupon: "0.15", active: true },
  { isin: "TRT150228T18", type: "TRT" as const, issue: "2023-02-15", maturity: "2028-02-15", coupon: "0.12", active: true },
  { isin: "TRB100326T12", type: "TRB" as const, issue: "2024-03-10", maturity: "2026-03-10", coupon: "0.08", active: true },
];

export default function AdminBondsPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display text-display-md text-foreground">Tahvil Yonetimi</h1>
          <p className="text-data-sm text-muted-foreground mt-1">Tahvil ekle, duzenle, sil</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Iptal" : "Yeni Tahvil Ekle"}
        </Button>
      </div>

      {showForm && (
        <Card className="amber-glow-border animate-fade-up">
          <CardHeader>
            <CardDescription>YENI KAYIT</CardDescription>
            <CardTitle className="mt-1">Tahvil Ekle</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2">
              {[
                { label: "ISIN KODU", placeholder: "TRT060127T10", type: "text" },
                { label: "TAHVIL TIPI", placeholder: "TRT veya TRB", type: "text" },
                { label: "IHRAC TARIHI", placeholder: "", type: "date" },
                { label: "VADE TARIHI", placeholder: "", type: "date" },
                { label: "KUPON ORANI", placeholder: "0.150000", type: "number" },
                { label: "NOMINAL DEGER", placeholder: "100.00", type: "number" },
              ].map((field) => (
                <div key={field.label} className="space-y-2">
                  <label className="text-label text-muted-foreground">{field.label}</label>
                  <Input type={field.type} placeholder={field.placeholder} className="font-mono-data" />
                </div>
              ))}
              <div className="md:col-span-2">
                <Button type="submit" className="w-full">Kaydet</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>VERITABANI</CardDescription>
              <CardTitle className="mt-1">Kayitli Tahviller</CardTitle>
            </div>
            <span className="text-label text-muted-foreground">{BONDS_DATA.length} KAYIT</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["ISIN", "TIP", "IHRAC", "VADE", "KUPON", "DURUM", "ISLEMLER"].map((h, i) => (
                    <th
                      key={h}
                      className={`pb-3 text-label text-muted-foreground font-normal ${i === 6 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BONDS_DATA.map((bond) => (
                  <tr key={bond.isin} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 font-mono-data text-data-sm text-foreground">{bond.isin}</td>
                    <td className="py-3">
                      <Badge variant={bond.type === "TRT" ? "default" : "secondary"}>{bond.type}</Badge>
                    </td>
                    <td className="py-3 font-mono-data text-data-sm text-muted-foreground">{bond.issue}</td>
                    <td className="py-3 font-mono-data text-data-sm text-muted-foreground">{bond.maturity}</td>
                    <td className="py-3 font-mono-data text-data-sm text-foreground">
                      %{(parseFloat(bond.coupon) * 100).toFixed(2)}
                    </td>
                    <td className="py-3">
                      <Badge variant={bond.active ? "positive" : "destructive"}>
                        {bond.active ? "AKTIF" : "PASIF"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right space-x-1">
                      <Button variant="ghost" size="sm">Duzenle</Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Sil</Button>
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
