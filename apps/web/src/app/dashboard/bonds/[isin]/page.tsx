"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, BondDetail } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDecimal, formatPercentFromDecimal, formatPercent, formatDate } from "@/lib/utils";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BondDetailPage({ params }: { params: { isin: string } }) {
  const { isin } = params;
  const [bond, setBond] = useState<BondDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Giris yapmaniz gerekiyor");
      setLoading(false);
      return;
    }
    const isInitial = bond === null || bond.isin_code !== isin;
    if (isInitial) setLoading(true);
    else setMetricsLoading(true);
    api.bonds
      .get(token, isin, { settlement_date: selectedDate })
      .then(setBond)
      .catch((e) => setError(e?.message || "Tahvil bulunamadi"))
      .finally(() => {
        setLoading(false);
        setMetricsLoading(false);
      });
    // Run when isin or selectedDate changes; bond used only to distinguish initial vs date-change load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isin, selectedDate]);

  if (loading)
    return <div className="py-12 text-center text-muted-foreground text-sm">Yukleniyor...</div>;
  if (error)
    return <div className="py-12 text-center text-destructive text-sm">{error}</div>;
  if (!bond)
    return <div className="py-12 text-center text-muted-foreground text-sm">Tahvil bulunamadi</div>;

  const topMetrics = [
    {
      label: "SON IHRAC FIYATI",
      value: formatDecimal(bond.last_issue_price, 3),
      highlight: true,
    },
    {
      label: "SON IHRAC GETIRISI",
      value: bond.last_issue_yield != null ? formatPercent(bond.last_issue_yield) : "—",
    },
    {
      label: "VADEYE KALAN",
      value: bond.days_to_maturity != null ? `${bond.days_to_maturity} gun` : "—",
    },
    {
      label: "KUPON ORANI",
      value: formatPercentFromDecimal(bond.next_coupon_rate, 4),
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
    ["Ilk Ihrac Tarihi", formatDate(bond.first_issue_date)],
    ["Itfa Tarihi", formatDate(bond.maturity_date)],
    ["Son Ihrac Tarihi", bond.last_issue_date_text || "—"],
    ["Sonraki Kupon Tarihi", formatDate(bond.next_coupon_date)],
    ["Vadeye Kalan Gun", bond.days_to_maturity != null ? `${bond.days_to_maturity}` : "—"],
  ];

  const financialInfo = [
    ["Ilk Ihrac Fiyati", formatDecimal(bond.first_issue_price, 3)],
    ["Son Ihrac Fiyati", formatDecimal(bond.last_issue_price, 3)],
    ["Ilk Ihrac Getirisi %", bond.first_issue_yield != null ? formatPercent(bond.first_issue_yield) : "—"],
    ["Son Ihrac Getirisi %", bond.last_issue_yield != null ? formatPercent(bond.last_issue_yield) : "—"],
    ["Sonraki Kupon Orani %", formatPercentFromDecimal(bond.next_coupon_rate, 4)],
    ["Spread %", formatPercentFromDecimal(bond.spread, 4)],
    [
      "Toplam Ihrac Tutari",
      bond.total_issue_amount != null
        ? `${formatDecimal(bond.total_issue_amount, 0)} (x1000 ${bond.currency})`
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

      <div className="animate-fade-up flex flex-wrap items-center gap-3">
        <label className="text-label text-muted-foreground" htmlFor="bond-settlement-date">
          Hesaplama tarihi
        </label>
        <input
          id="bond-settlement-date"
          type="date"
          value={selectedDate}
          max={todayISO()}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 font-mono-data text-data-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {metricsLoading && (
          <span className="text-label text-muted-foreground">Hesaplaniyor...</span>
        )}
      </div>

      {bond.calculated_metrics && !metricsLoading && (
        <Card className="animate-fade-up border-primary/30 bg-primary/5">
          <CardHeader>
            <CardDescription>HESAPLANAN METRIKLER</CardDescription>
            <CardTitle className="mt-1">
              Kirli Fiyat, Oran Degisimi, Getiri ve Risk — {formatDate(selectedDate)} tarihi icin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border/50 bg-card p-4">
                <div className="text-label text-muted-foreground mb-1">Kirli Fiyat</div>
                <div className="font-mono-data text-stat text-primary">
                  {formatDecimal(bond.calculated_metrics.dirty_price, 8, 8)}
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-card p-4">
                <div className="text-label text-muted-foreground mb-1">Birikmis Faiz</div>
                <div className="font-mono-data text-stat">
                  {formatDecimal(bond.calculated_metrics.accrued_interest, 8, 8)}
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-card p-4">
                <div className="text-label text-muted-foreground mb-1">Oran Degisimi (Gunluk TLREF %)</div>
                <div className="font-mono-data text-stat">
                  {bond.calculated_metrics.rate_change_today_pct != null
                    ? formatPercent(bond.calculated_metrics.rate_change_today_pct)
                    : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-card p-4">
                <div className="text-label text-muted-foreground mb-1">Temiz Fiyat (Kullanilan)</div>
                <div className="font-mono-data text-stat">{formatDecimal(bond.calculated_metrics.clean_price_used, 8, 8)}</div>
              </div>
              {bond.calculated_metrics.annual_reference_rate != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Yillik Gosterge Faiz Orani</div>
                  <div className="font-mono-data text-stat">
                    {formatPercentFromDecimal(bond.calculated_metrics.annual_reference_rate, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.annual_coupon_rate != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Yillik Kupon Faiz Orani</div>
                  <div className="font-mono-data text-stat">
                    {formatPercentFromDecimal(bond.calculated_metrics.annual_coupon_rate, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.periodic_coupon_rate != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Donemsel Kupon Faiz Orani</div>
                  <div className="font-mono-data text-stat">
                    {formatPercentFromDecimal(bond.calculated_metrics.periodic_coupon_rate, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.yield_to_maturity != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Vadeye Kadar Getiri (YTM)</div>
                  <div className="font-mono-data text-stat">
                    {formatPercentFromDecimal(bond.calculated_metrics.yield_to_maturity, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.spread != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Spread</div>
                  <div className="font-mono-data text-stat">
                    {formatPercentFromDecimal(bond.calculated_metrics.spread, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.modified_duration != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Modifiye Durasyon</div>
                  <div className="font-mono-data text-stat">
                    {formatDecimal(bond.calculated_metrics.modified_duration, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.macaulay_duration != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Macaulay Durasyon</div>
                  <div className="font-mono-data text-stat">
                    {formatDecimal(bond.calculated_metrics.macaulay_duration, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.convexity != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Konveksite</div>
                  <div className="font-mono-data text-stat">
                    {formatDecimal(bond.calculated_metrics.convexity, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.coupon_payment_amount != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Kupon Odeme Tutari</div>
                  <div className="font-mono-data text-stat">
                    {formatDecimal(bond.calculated_metrics.coupon_payment_amount, 4)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!bond.calculated_metrics && !metricsLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Hesaplanan Metrikler</CardTitle>
            <CardDescription>
              {selectedDate === todayISO()
                ? "Bugun icin"
                : `${formatDate(selectedDate)} tarihi icin`}{" "}
              piyasa verisi bulunamadi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted/50 border border-border rounded-xl text-center">
              <p className="text-sm text-muted-foreground">
                {selectedDate === todayISO()
                  ? "Bugun icin piyasa verisi henuz yuklenmemis veya mevcut degil."
                  : `${formatDate(selectedDate)} tarihi icin piyasa verisi bulunmamaktadir.`}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Lutfen baska bir tarih secin veya veri yukleme islemini bekleyin.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
