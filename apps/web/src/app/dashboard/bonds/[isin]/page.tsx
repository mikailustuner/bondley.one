"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { FileQuestion, AlertCircle, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { api, BondDetail } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDecimal, formatPercentFromDecimal, formatPercent, formatDate, formatLastIssueDateText } from "@/lib/utils";


function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function lastBusinessDayISO(): string {
  const d = new Date();
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 2);
  else if (day === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function weekAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function monthAgoISO(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export default function BondDetailPage({
  params,
}: {
  params: Promise<{ isin: string }>;
}) {
  const { isin } = use(params);
  const [bond, setBond] = useState<BondDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());
  const [prevIsin, setPrevIsin] = useState<string | null>(null);
  const [nextIsin, setNextIsin] = useState<string | null>(null);
  const [scenarioShockBp, setScenarioShockBp] = useState(0);
  const [scenarioResult, setScenarioResult] = useState<{
    new_ytm_approx: number;
    new_dirty_price_approx: number;
    price_change_pct: number;
    shock_bp: number;
  } | null>(null);
  const [baseScenarioMetrics, setBaseScenarioMetrics] = useState<{
    current_ytm: number;
    current_dirty_price: number;
    modified_duration: number | null;
  } | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteToggling, setFavoriteToggling] = useState(false);

  useEffect(() => {
    if (bond) setIsFavorite(!!bond.is_favorite);
  }, [bond]);

  useEffect(() => {
    if (!isin) {
      setError("Menkul k�ymet kodu belirtilmedi");
      setLoading(false);
      return;
    }
    const token = getToken();
    if (!token) {
      setError("Giriş yapmanız gerekiyor");
      setLoading(false);
      return;
    }
    const isInitial = bond === null || bond?.isin_code !== isin;
    if (isInitial) setLoading(true);
    else setMetricsLoading(true);
    setError(null);
    api.bonds
      .get(token, isin, { settlement_date: selectedDate })
      .then(setBond)
      .catch((e) => setError(e?.message || "Bor�lanma arac� bulunamad�"))
      .finally(() => {
        setLoading(false);
        setMetricsLoading(false);
      });
    // Run when isin or selectedDate changes; bond used only to distinguish initial vs date-change load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isin, selectedDate]);

  useEffect(() => {
    document.title = `${isin} — Bondley`;
    return () => {
      document.title = "Bondley";
    };
  }, [isin]);

  useEffect(() => {
    if (!isin) return;
    try {
      const raw = sessionStorage.getItem("bondley_bonds_isins");
      const list: string[] = raw ? JSON.parse(raw) : [];
      const idx = list.indexOf(isin);
      if (idx > 0) setPrevIsin(list[idx - 1] ?? null);
      else setPrevIsin(null);
      if (idx >= 0 && idx < list.length - 1) setNextIsin(list[idx + 1] ?? null);
      else setNextIsin(null);
    } catch {
      setPrevIsin(null);
      setNextIsin(null);
    }
  }, [isin]);

  // Senaryo: TLREF şoku — debounced fetch
  useEffect(() => {
    if (!bond?.calculated_metrics || !isin) {
      setScenarioResult(null);
      setBaseScenarioMetrics(null);
      return;
    }
    const token = getToken();
    if (!token) return;
    const t = setTimeout(() => {
      setScenarioLoading(true);
      api.bonds
        .scenario(token, isin, { settlement_date: selectedDate, tlref_shock_bp: scenarioShockBp })
        .then((r) => {
          setScenarioResult({
            shock_bp: r.shock_bp,
            new_ytm_approx: r.new_ytm_approx,
            new_dirty_price_approx: r.new_dirty_price_approx,
            price_change_pct: r.price_change_pct,
          });
          setBaseScenarioMetrics({
            current_ytm: r.current_ytm,
            current_dirty_price: r.current_dirty_price,
            modified_duration: r.modified_duration ?? null,
          });
        })
        .catch(() => setScenarioResult(null))
        .finally(() => setScenarioLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [bond?.calculated_metrics, isin, selectedDate, scenarioShockBp]);

  if (!isin)
    return (
      <EmptyState
        variant="error"
        title="Menkul k�ymet kodu belirtilmedi"
        icon={<AlertCircle className="h-7 w-7" />}
        action={{ label: "Listeye don", href: "/dashboard/bonds" }}
      />
    );
  if (loading)
    return <div className="py-12 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  if (error)
    return (
      <EmptyState
        variant="error"
        title={error === "Giriş yapmanız gerekiyor" ? "Giriş gerekli" : "Hata"}
        description={error}
        icon={<AlertCircle className="h-7 w-7" />}
        action={
          error === "Giriş yapmanız gerekiyor"
            ? { label: "Giriş yap", href: "/login" }
            : { label: "Listeye dön", href: "/dashboard/bonds" }
        }
      />
    );
  if (!bond)
    return (
      <EmptyState
        title="Bor�lanma arac� bulunamad�"
        description="Belirtilen ISIN ile bir tahvil kaydı bulunamadı."
        icon={<FileQuestion className="h-7 w-7" />}
        action={{ label: "Listeye dön", href: "/dashboard/bonds" }}
      />
    );

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
      value: bond.days_to_maturity != null ? `${bond.days_to_maturity} gün` : "—",
    },
    {
      label: "KUPON ORANI",
      value: formatPercentFromDecimal(bond.next_coupon_rate, 4),
    },
  ];

  const generalInfo = [
    ["ISIN Kodu", bond.isin_code],
    ["İhraççı", bond.issuer],
    ["İhraç Türü", bond.issuance_type],
    ["Getiri Turu", bond.yield_type],
    ["MK Turu", bond.security_type],
    ["Kupon Sikligi", bond.coupon_frequency],
    ["Para Birimi", bond.currency],
    ["Grup Kodu", bond.group_code],
    ["Detay Tipi", bond.security_type_detail],
    ["Gün Sayım", bond.day_count_convention],
    ["Emir Giriş Yöntemi", bond.quotation_method],
  ];

  const dateInfo = [
    ["İlk İhraç Tarihi", formatDate(bond.first_issue_date)],
    ["İtfa Tarihi", formatDate(bond.maturity_date)],
    ["Son İhraç Tarihi", formatLastIssueDateText(bond.last_issue_date_text)],
    ["Sonraki Kupon Tarihi", formatDate(bond.next_coupon_date)],
    ["Vadeye Kalan Gün", bond.days_to_maturity != null ? `${bond.days_to_maturity}` : "—"],
  ];

  const financialInfo = [
    ["İlk İhraç Fiyatı", formatDecimal(bond.first_issue_price, 3)],
    ["Son İhraç Fiyatı", formatDecimal(bond.last_issue_price, 3)],
    ["İlk İhraç Getirisi %", bond.first_issue_yield != null ? formatPercent(bond.first_issue_yield) : "—"],
    ["Son İhraç Getirisi %", bond.last_issue_yield != null ? formatPercent(bond.last_issue_yield) : "—"],
    ["Sonraki Kupon Oranı %", formatPercentFromDecimal(bond.next_coupon_rate, 4)],
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
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-2 text-data-sm">
            <li>
              <Link
                href="/dashboard/bonds"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Tahviller
              </Link>
            </li>
            <li className="text-muted-foreground/40" aria-hidden>/</li>
            <li aria-current="page" className="font-bond-nums text-foreground">
              {bond.isin_code}
            </li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-bond-nums text-display-md text-foreground">{bond.isin_code}</h1>
          <Badge variant="default">{bond.currency}</Badge>
          {!bond.is_active && <Badge variant="destructive">PASIF</Badge>}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => {
                const token = getToken();
                if (!token || favoriteToggling) return;
                setFavoriteToggling(true);
                if (isFavorite) {
                  api.bonds
                    .removeFavorite(token, bond.isin_code)
                    .then(() => setIsFavorite(false))
                    .catch(() => { })
                    .finally(() => setFavoriteToggling(false));
                } else {
                  api.bonds
                    .addFavorite(token, bond.isin_code)
                    .then(() => setIsFavorite(true))
                    .catch(() => { })
                    .finally(() => setFavoriteToggling(false));
                }
              }}
              disabled={favoriteToggling}
              aria-label={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
            >
              <Star
                className={`h-4 w-4 ${isFavorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
              />
              {isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
            </Button>
            {prevIsin ? (
              <Link href={`/dashboard/bonds/${prevIsin}`}>
                <Button variant="outline" size="sm" className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Önceki
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" className="gap-1" disabled>
                <ChevronLeft className="h-4 w-4" />
                Onceki
              </Button>
            )}
            {nextIsin ? (
              <Link href={`/dashboard/bonds/${nextIsin}`}>
                <Button variant="outline" size="sm" className="gap-1">
                  Sonraki
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" className="gap-1" disabled>
                Sonraki
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-data-sm text-muted-foreground mt-1">
          {bond.issuer || "Bilinmiyor"} &middot;{" "}
          {bond.security_type ? bond.security_type.split("/")[0].trim() : "—"}
        </p>
      </div>

      <div className="animate-fade-up flex flex-wrap items-center gap-3">
        <label className="text-label text-muted-foreground" htmlFor="bond-settlement-date">
          Hesaplama tarihi
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="bond-settlement-date"
            type="date"
            value={selectedDate}
            max={todayISO()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 font-bond-nums text-data-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex flex-wrap gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(todayISO())}
              className="text-data-sm"
            >
              Bugün
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(lastBusinessDayISO())}
              className="text-data-sm"
            >
              Son iş günü
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(weekAgoISO())}
              className="text-data-sm"
            >
              1 hafta önce
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(monthAgoISO())}
              className="text-data-sm"
            >
              1 ay önce
            </Button>
          </div>
        </div>
        {!bond.calculated_metrics && !metricsLoading && (
          <span className="text-label text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            Bu tarih için piyasa verisi yok
          </span>
        )}
        {metricsLoading && (
          <span className="text-label text-muted-foreground">Hesaplaniyor...</span>
        )}
      </div>

      {bond.calculated_metrics && !metricsLoading && (
        <Card className="animate-fade-up border-primary/30 bg-primary/5">
          <CardHeader>
            <CardDescription>HESAPLANAN METRIKLER</CardDescription>
            <CardTitle className="mt-1">
              Kirli Fiyat, Oran Değişimi, Getiri ve Risk — {formatDate(selectedDate)} tarihi için
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border/50 bg-card p-4">
                <div className="text-label text-muted-foreground mb-1">Kirli Fiyat</div>
                <div className="font-bond-nums text-stat text-primary">
                  {formatDecimal(bond.calculated_metrics.dirty_price, 8, 8)}
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-card p-4">
                <div className="text-label text-muted-foreground mb-1">Birikmis Faiz</div>
                <div className="font-bond-nums text-stat">
                  {formatDecimal(bond.calculated_metrics.accrued_interest, 8, 8)}
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-card p-4">
                <div className="text-label text-muted-foreground mb-1">Oran Degisimi (Gunluk TLREF %)</div>
                <div className="font-bond-nums text-stat">
                  {bond.calculated_metrics.rate_change_today_pct != null
                    ? formatPercent(bond.calculated_metrics.rate_change_today_pct)
                    : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-card p-4">
                <div className="text-label text-muted-foreground mb-1">Temiz Fiyat (Kullanilan)</div>
                <div className="font-bond-nums text-stat">{formatDecimal(bond.calculated_metrics.clean_price_used, 8, 8)}</div>
              </div>
              {bond.calculated_metrics.annual_reference_rate != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Yillik Gosterge Faiz Orani</div>
                  <div className="font-bond-nums text-stat">
                    {formatPercentFromDecimal(bond.calculated_metrics.annual_reference_rate, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.annual_coupon_rate != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Yillik Kupon Faiz Orani</div>
                  <div className="font-bond-nums text-stat">
                    {formatPercentFromDecimal(bond.calculated_metrics.annual_coupon_rate, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.periodic_coupon_rate != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Donemsel Kupon Faiz Orani</div>
                  <div className="font-bond-nums text-stat">
                    {formatPercentFromDecimal(bond.calculated_metrics.periodic_coupon_rate, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.yield_to_maturity != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Vadeye Kadar Getiri (YTM)</div>
                  <div className="font-bond-nums text-stat">
                    {formatPercentFromDecimal(bond.calculated_metrics.yield_to_maturity, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.return_to_date_pct != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">
                    Başlangıçtan seçilen tarihe getiri
                    {selectedDate && (
                      <span className="block font-normal text-muted-foreground/80 mt-0.5">
                        İlk ihraç → {formatDate(selectedDate)}
                      </span>
                    )}
                  </div>
                  <div className="font-bond-nums text-stat">
                    {formatPercent(bond.calculated_metrics.return_to_date_pct)}
                  </div>
                  {bond.calculated_metrics.return_to_date_used_fallback_price && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Veri bulunamadığı için 100 olarak kabul edilmiştir.
                    </p>
                  )}
                </div>
              )}
              {bond.calculated_metrics.spread != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Spread</div>
                  <div className="font-bond-nums text-stat">
                    {formatPercentFromDecimal(bond.calculated_metrics.spread, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.modified_duration != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Modifiye Durasyon</div>
                  <div className="font-bond-nums text-stat">
                    {formatDecimal(bond.calculated_metrics.modified_duration, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.macaulay_duration != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Macaulay Durasyon</div>
                  <div className="font-bond-nums text-stat">
                    {formatDecimal(bond.calculated_metrics.macaulay_duration, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.convexity != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Konveksite</div>
                  <div className="font-bond-nums text-stat">
                    {formatDecimal(bond.calculated_metrics.convexity, 4)}
                  </div>
                </div>
              )}
              {bond.calculated_metrics.coupon_payment_amount != null && (
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <div className="text-label text-muted-foreground mb-1">Kupon Odeme Tutari</div>
                  <div className="font-bond-nums text-stat">
                    {formatDecimal(bond.calculated_metrics.coupon_payment_amount, 4)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {bond.calculated_metrics && !metricsLoading && (
        <Card className="animate-fade-up">
          <CardHeader>
            <CardDescription>SENARYO</CardDescription>
            <CardTitle className="mt-1">TLREF değişimi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-label text-muted-foreground block mb-2">
                TLREF şoku (baz puan): {scenarioShockBp > 0 ? "+" : ""}{scenarioShockBp} bp
              </label>
              <input
                type="range"
                min={-100}
                max={100}
                step={5}
                value={scenarioShockBp}
                onChange={(e) => setScenarioShockBp(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none bg-muted accent-primary"
              />
              {baseScenarioMetrics && (
                <p className="text-data-sm text-muted-foreground mt-2 py-1.5 px-2 rounded-md bg-muted/50 border border-border/50">
                  <span className="font-medium text-foreground">Anlık önizleme:</span>{" "}
                  Tahmini kirli fiyat{" "}
                  <span className="font-bond-nums text-foreground">
                    {formatDecimal(
                      baseScenarioMetrics.current_dirty_price *
                      (1 -
                        (baseScenarioMetrics.modified_duration ?? 0) *
                        (scenarioShockBp / 10000)),
                      4,
                      4
                    )}
                  </span>
                  , değişim{" "}
                  <span
                    className={
                      (baseScenarioMetrics.modified_duration ?? 0) * scenarioShockBp <= 0
                        ? "text-negative"
                        : "text-positive"
                    }
                  >
                    {formatPercent(
                      -((baseScenarioMetrics.modified_duration ?? 0) * (scenarioShockBp / 10000)) * 100
                    )}
                  </span>
                  {" · "}
                  YTM{" "}
                  <span className="font-bond-nums text-foreground">
                    {formatPercentFromDecimal(
                      baseScenarioMetrics.current_ytm + scenarioShockBp / 10000,
                      4
                    )}
                  </span>
                </p>
              )}
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>-100 bp</span>
                <span>0</span>
                <span>+100 bp</span>
              </div>
            </div>
            {scenarioLoading && (
              <p className="text-data-sm text-muted-foreground">Hesaplanıyor...</p>
            )}
            {!scenarioLoading && scenarioResult && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                <p className="text-data-sm text-foreground">
                  TLREF {scenarioResult.shock_bp > 0 ? "+" : ""}{scenarioResult.shock_bp} bp → Tahmini
                  kirli fiyat: {formatDecimal(scenarioResult.new_dirty_price_approx, 4, 4)}, değişim:{" "}
                  <span
                    className={
                      scenarioResult.price_change_pct >= 0 ? "text-positive" : "text-negative"
                    }
                  >
                    {formatPercent(scenarioResult.price_change_pct)}
                  </span>
                </p>
                <p className="text-label text-muted-foreground mt-1">
                  Tahmini YTM: {formatPercentFromDecimal(scenarioResult.new_ytm_approx, 4)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!bond.calculated_metrics && !metricsLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Hesaplanan Metrikler</CardTitle>
            <CardDescription>
              {selectedDate === todayISO()
                ? "Bugün için"
                : `${formatDate(selectedDate)} tarihi için`}{" "}
              piyasa verisi bulunamadı
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted/50 border border-border rounded-xl text-center">
              <p className="text-sm text-muted-foreground">
                {selectedDate === todayISO()
                  ? "Bugün için piyasa verisi henüz yüklenmemiş veya mevcut değil."
                  : `${formatDate(selectedDate)} tarihi için piyasa verisi bulunmamaktadır.`}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Lütfen başka bir tarih seçin veya veri yükleme işlemini bekleyin.
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
              className={`font-bond-nums text-stat ${m.highlight ? "text-primary" : "text-foreground"}`}
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
            <CardTitle className="mt-1">Genel Detaylar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {generalInfo.map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-2.5 border-b border-border/30 last:border-0"
                >
                  <span className="text-data-sm text-muted-foreground">{label}</span>
                  <span className="font-bond-nums text-data-sm text-foreground text-right max-w-[60%]">
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
            <CardTitle className="mt-1">İhraç ve Vade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {dateInfo.map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-2.5 border-b border-border/30 last:border-0"
                >
                  <span className="text-data-sm text-muted-foreground">{label}</span>
                  <span className="font-bond-nums text-data-sm text-foreground">{value}</span>
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
                  <span className="font-bond-nums text-data-sm text-foreground">{value}</span>
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
                  <span className="font-bond-nums text-data-sm text-foreground text-right max-w-[60%]">
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
