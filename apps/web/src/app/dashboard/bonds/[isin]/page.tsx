"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, BondDetail } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

function fmt(val: number | string | null | undefined, decimals = 2): string {
  if (val == null) return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? "—" : n.toLocaleString("tr-TR", { maximumFractionDigits: decimals });
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("tr-TR");
  } catch {
    return val;
  }
}

export default function BondDetailPage({ params }: { params: { isin: string } }) {
  const { isin } = params;
  const [bond, setBond] = useState<BondDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Giris yapmaniz gerekiyor");
      setLoading(false);
      return;
    }
    api.bonds
      .get(token, isin)
      .then(setBond)
      .catch((e) => setError(e?.message || "Tahvil bulunamadi"))
      .finally(() => setLoading(false));
  }, [isin]);

  if (loading)
    return <div className="py-12 text-center text-muted-foreground text-sm">Yukleniyor...</div>;
  if (error)
    return <div className="py-12 text-center text-destructive text-sm">{error}</div>;
  if (!bond)
    return <div className="py-12 text-center text-muted-foreground text-sm">Tahvil bulunamadi</div>;

  const topMetrics = [
    {
      label: "SON IHRAC FIYATI",
      value: bond.last_issue_price != null ? fmt(bond.last_issue_price, 3) : "—",
      highlight: true,
    },
    {
      label: "SON IHRAC GETIRISI",
      value: bond.last_issue_yield != null ? `%${fmt(bond.last_issue_yield, 2)}` : "—",
    },
    {
      label: "VADEYE KALAN",
      value: bond.days_to_maturity != null ? `${bond.days_to_maturity} gun` : "—",
    },
    {
      label: "KUPON ORANI",
      value: bond.next_coupon_rate != null ? `%${fmt(bond.next_coupon_rate, 4)}` : "—",
    },
  ];

  const generalInfo = [
    ["ISIN Kodu", bond.isin_code],
    ["Ihracçi", bond.issuer],
    ["Ihrac Turu", bond.issuance_type],
    ["Getiri Turu", bond.yield_type],
    ["MK Turu", bond.security_type],
    ["Kupon Sikligi", bond.coupon_frequency],
    ["Para Birimi", bond.currency],
    ["Grup Kodu", bond.group_code],
    ["Detay Tipi", bond.security_type_detail],
    ["Gun Sayim", bond.day_count_convention],
    ["Emir Giris Yontemi", bond.quotation_method],
  ];

  const dateInfo = [
    ["Ilk Ihrac Tarihi", fmtDate(bond.first_issue_date)],
    ["Itfa Tarihi", fmtDate(bond.maturity_date)],
    ["Son Ihrac Tarihi", bond.last_issue_date_text || "—"],
    ["Sonraki Kupon Tarihi", fmtDate(bond.next_coupon_date)],
    ["Vadeye Kalan Gun", bond.days_to_maturity != null ? `${bond.days_to_maturity}` : "—"],
  ];

  const financialInfo = [
    ["Ilk Ihrac Fiyati", bond.first_issue_price != null ? fmt(bond.first_issue_price, 3) : "—"],
    ["Son Ihrac Fiyati", bond.last_issue_price != null ? fmt(bond.last_issue_price, 3) : "—"],
    [
      "Ilk Ihrac Getirisi %",
      bond.first_issue_yield != null ? `%${fmt(bond.first_issue_yield, 2)}` : "—",
    ],
    [
      "Son Ihrac Getirisi %",
      bond.last_issue_yield != null ? `%${fmt(bond.last_issue_yield, 2)}` : "—",
    ],
    [
      "Sonraki Kupon Orani %",
      bond.next_coupon_rate != null ? `%${fmt(bond.next_coupon_rate, 4)}` : "—",
    ],
    ["Spread %", bond.spread != null ? `%${fmt(bond.spread, 4)}` : "—"],
    [
      "Toplam Ihrac Tutari",
      bond.total_issue_amount != null
        ? `${fmt(bond.total_issue_amount, 0)} (x1000 ${bond.currency})`
        : "—",
    ],
  ];

  const formulaInfo = [
    ["Islemis Faiz/Kira", bond.accrued_interest_text],
    ["Temiz Fiyat", bond.clean_price_text],
    ["Kirli Fiyat", bond.dirty_price_formula],
    ["Takas Fiyati", bond.settlement_price_formula],
    ["Getiri", bond.yield_formula],
    ["Bilesik Getiri", bond.compound_yield_formula],
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/dashboard/bonds"
            className="text-data-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Tahviller
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <h1 className="font-mono-data text-display-md text-foreground">{bond.isin_code}</h1>
          <Badge variant="default">{bond.currency}</Badge>
          {!bond.is_active && <Badge variant="destructive">PASIF</Badge>}
        </div>
        <p className="text-data-sm text-muted-foreground">
          {bond.issuer || "Bilinmiyor"} &middot;{" "}
          {bond.security_type ? bond.security_type.split("/")[0].trim() : "—"}
        </p>
      </div>

      <div className="grid gap-px md:grid-cols-4 bg-border/30 rounded-lg overflow-hidden animate-fade-up">
        {topMetrics.map((m) => (
          <div
            key={m.label}
            className={`bg-card p-5 grain ${m.highlight ? "amber-glow-border" : ""}`}
          >
            <div className="text-label text-muted-foreground mb-2">{m.label}</div>
            <div
              className={`font-mono-data text-stat ${m.highlight ? "text-primary" : "text-foreground"}`}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 animate-fade-up-delay-1">
        <Card>
          <CardHeader>
            <CardDescription>GENEL BILGILER</CardDescription>
            <CardTitle className="mt-1">Tahvil Detaylari</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {generalInfo.map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-2.5 border-b border-border/30 last:border-0"
                >
                  <span className="text-data-sm text-muted-foreground">{label}</span>
                  <span className="font-mono-data text-data-sm text-foreground text-right max-w-[60%]">
                    {value ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>TARIH BILGILERI</CardDescription>
            <CardTitle className="mt-1">Ihrac ve Vade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {dateInfo.map(([label, value]) => (
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

      <div className="grid gap-6 lg:grid-cols-2 animate-fade-up-delay-2">
        <Card>
          <CardHeader>
            <CardDescription>FINANSAL VERILER</CardDescription>
            <CardTitle className="mt-1">Fiyat ve Getiri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {financialInfo.map(([label, value]) => (
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

        <Card>
          <CardHeader>
            <CardDescription>HESAPLAMA YONTEMLERI</CardDescription>
            <CardTitle className="mt-1">Formul ve Konvansiyon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {formulaInfo.map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-2.5 border-b border-border/30 last:border-0"
                >
                  <span className="text-data-sm text-muted-foreground">{label}</span>
                  <span className="font-mono-data text-data-sm text-foreground text-right max-w-[60%]">
                    {value ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {bond.remarks && (
        <Card className="animate-fade-up-delay-2">
          <CardHeader>
            <CardDescription>NOTLAR</CardDescription>
            <CardTitle className="mt-1">Aciklamalar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-data-sm text-muted-foreground whitespace-pre-wrap">
              {bond.remarks}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
