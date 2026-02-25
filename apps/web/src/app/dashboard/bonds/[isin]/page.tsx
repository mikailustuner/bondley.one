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
import { useProMode } from "@/components/pro-mode-provider";

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
  const { isPro } = useProMode();
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
          <h1 className={`${isPro ? "text-primary text-2xl" : "text-display-md text-foreground"} font-bond-nums`}>
            {isPro && <span className="mr-1 opacity-70">&gt;</span>}{bond.isin_code}
          </h1>
          <Badge variant={isPro ? "outline" : "default"} className={isPro ? "border-primary text-primary bg-primary/10 rounded-none ml-2" : ""}>{bond.currency}</Badge>
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
        <Card className={`animate-fade-up ${isPro ? "rounded-none border-primary/50 bg-[#001]" : "border-primary/30 bg-primary/5"}`}>
          <CardHeader className={isPro ? "bg-primary/5 border-b border-primary/20 py-2 px-3" : ""}>
            <CardDescription className={isPro ? "text-primary/70" : ""}>HESAPLANAN METRIKLER</CardDescription>
            <CardTitle className={isPro ? "text-sm text-primary font-mono mt-0" : "mt-1"}>
              {isPro ? "[KIRLI_FIYAT ORAN_DEGISIMI_GETIRI_RISK]" : "Kirli Fiyat, Oran Değişimi, Getiri ve Risk"} — {formatDate(selectedDate)} tarihi için
            </CardTitle>
          </CardHeader>
          <CardContent className={isPro ? "p-3" : ""}>
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
        <Card className={`animate-fade-up ${isPro ? "rounded-none border-primary/50" : ""}`}>
          <CardHeader className={isPro ? "bg-primary/5 border-b border-primary/20 py-2 px-3" : ""}>
            <CardDescription className={isPro ? "text-primary/70" : ""}>SENARYO</CardDescription>
            <CardTitle className={isPro ? "text-sm text-primary font-mono mt-0" : "mt-1"}>{isPro ? "[TLREF_DEGISIMI]" : "TLREF değişimi"}</CardTitle>
          </CardHeader>
          <CardContent className={`space-y-4 ${isPro ? "p-3" : ""}`}>
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

      {bond.calculated_metrics?.used_fallback_market_data && bond.calculated_metrics?.market_data_date && (
        <div className="p-3 rounded-md border border-amber-500/20 bg-amber-500/5 text-data-sm text-muted-foreground animate-fade-up">
          <span className="font-medium text-amber-600 dark:text-amber-400">Not:</span>{" "}
          Seçilen tarih için piyasa verisi henüz mevcut değil.{" "}
          <span className="font-mono-data">{formatDate(bond.calculated_metrics.market_data_date)}</span>{" "}
          tarihli en güncel veri kullanılmaktadır.
        </div>
      )}

      <div className={`grid gap-px md:grid-cols-4 bg-border/30 overflow-hidden animate-fade-up ${isPro ? "rounded-none border-t border-b border-primary/30" : "rounded-lg"}`}>
        {topMetrics.map((m) => (
          <div
            key={m.label}
            className={`bg-card ${isPro ? "px-4 py-3 border-r border-primary/20 last:border-0" : "p-5 grain"} ${m.highlight && !isPro ? "amber-glow-border" : ""}`}
          >
            <div className={`text-label mb-2 ${isPro ? (m.highlight ? "text-primary font-bold" : "text-primary/70") : "text-muted-foreground"}`}>{m.label}</div>
            <div
              className={`font-bond-nums text-stat ${m.highlight ? "text-primary" : "text-foreground"}`}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 animate-fade-up-delay-1">
        <Card className={isPro ? "rounded-none border-primary/50" : ""}>
          <CardHeader className={isPro ? "bg-primary/5 border-b border-primary/20 py-2 px-3" : ""}>
            {!isPro && <CardDescription>GENEL BILGILER</CardDescription>}
            <CardTitle className={isPro ? "text-sm text-primary font-mono mt-0" : "mt-1"}>{isPro ? "[GENEL_DETAYLAR]" : "Genel Detaylar"}</CardTitle>
          </CardHeader>
          <CardContent className={isPro ? "p-0" : ""}>
            <div className={`space-y-0 ${isPro ? "font-mono" : ""}`}>
              {generalInfo.map(([label, value]) => (
                <div
                  key={label}
                  className={`flex justify-between items-center ${isPro ? "py-1 px-3" : "py-2.5"} border-b ${isPro ? "border-primary/10" : "border-border/30"} last:border-0`}
                >
                  <span className={`text-data-sm ${isPro ? "text-primary/70 text-xs" : "text-muted-foreground"}`}>{label}</span>
                  <span className={`font-bond-nums text-data-sm ${isPro ? "text-primary text-xs" : "text-foreground"} text-right max-w-[60%]`}>
                    {value ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={isPro ? "rounded-none border-primary/50" : ""}>
          <CardHeader className={isPro ? "bg-primary/5 border-b border-primary/20 py-2 px-3" : ""}>
            {!isPro && <CardDescription>TARIH BILGILERI</CardDescription>}
            <CardTitle className={isPro ? "text-sm text-primary font-mono mt-0" : "mt-1"}>{isPro ? "[IHRAC_VE_VADE]" : "İhraç ve Vade"}</CardTitle>
          </CardHeader>
          <CardContent className={isPro ? "p-0" : ""}>
            <div className={`space-y-0 ${isPro ? "font-mono" : ""}`}>
              {dateInfo.map(([label, value]) => (
                <div
                  key={label}
                  className={`flex justify-between items-center ${isPro ? "py-1.5 px-3" : "py-2.5"} border-b ${isPro ? "border-primary/10" : "border-border/30"} last:border-0`}
                >
                  <span className={`text-data-sm ${isPro ? "text-primary/70 text-xs" : "text-muted-foreground"}`}>{label}</span>
                  <span className={`font-bond-nums text-data-sm ${isPro ? "text-primary text-xs" : "text-foreground"}`}>{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 animate-fade-up-delay-2">
        <Card className={isPro ? "rounded-none border-primary/50" : ""}>
          <CardHeader className={isPro ? "bg-primary/5 border-b border-primary/20 py-2 px-3" : ""}>
            {!isPro && <CardDescription>FINANSAL VERILER</CardDescription>}
            <CardTitle className={isPro ? "text-sm text-primary font-mono mt-0" : "mt-1"}>{isPro ? "[FIYAT_VE_GETIRI]" : "Fiyat ve Getiri"}</CardTitle>
          </CardHeader>
          <CardContent className={isPro ? "p-0" : ""}>
            <div className={`space-y-0 ${isPro ? "font-mono" : ""}`}>
              {financialInfo.map(([label, value]) => (
                <div
                  key={label}
                  className={`flex justify-between items-center ${isPro ? "py-1.5 px-3" : "py-2.5"} border-b ${isPro ? "border-primary/10" : "border-border/30"} last:border-0`}
                >
                  <span className={`text-data-sm ${isPro ? "text-primary/70 text-xs" : "text-muted-foreground"}`}>{label}</span>
                  <span className={`font-bond-nums text-data-sm ${isPro ? "text-primary text-xs" : "text-foreground"}`}>{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={isPro ? "rounded-none border-primary/50" : ""}>
          <CardHeader className={isPro ? "bg-primary/5 border-b border-primary/20 py-2 px-3" : ""}>
            {!isPro && <CardDescription>HESAPLAMA YONTEMLERI</CardDescription>}
            <CardTitle className={isPro ? "text-sm text-primary font-mono mt-0" : "mt-1"}>{isPro ? "[FORMUL_VE_KONVANSİYON]" : "Formul ve Konvansiyon"}</CardTitle>
          </CardHeader>
          <CardContent className={isPro ? "p-0" : ""}>
            <div className={`space-y-0 ${isPro ? "font-mono" : ""}`}>
              {formulaInfo.map(([label, value]) => (
                <div
                  key={label}
                  className={`flex justify-between items-center ${isPro ? "py-1.5 px-3" : "py-2.5"} border-b ${isPro ? "border-primary/10" : "border-border/30"} last:border-0`}
                >
                  <span className={`text-data-sm ${isPro ? "text-primary/70 text-xs" : "text-muted-foreground"}`}>{label}</span>
                  <span className={`font-bond-nums text-data-sm ${isPro ? "text-primary text-xs" : "text-foreground"} text-right max-w-[60%]`}>
                    {value ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {bond.remarks && (
        <Card className={`animate-fade-up-delay-2 ${isPro ? "rounded-none border-primary/50" : ""}`}>
          <CardHeader className={isPro ? "bg-primary/5 border-b border-primary/20 py-2 px-3" : ""}>
            <CardDescription className={isPro ? "text-primary/70" : ""}>NOTLAR</CardDescription>
            <CardTitle className={isPro ? "text-sm text-primary font-mono mt-0" : "mt-1"}>{isPro ? "[ACIKLAMALAR]" : "Aciklamalar"}</CardTitle>
          </CardHeader>
          <CardContent className={isPro ? "p-3" : ""}>
            <p className={`whitespace-pre-wrap ${isPro ? "text-primary/80 text-xs font-mono" : "text-data-sm text-muted-foreground"}`}>
              {bond.remarks}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Veri Uyuşmazlıkları ─── */}
      {bond.data_conflicts && bond.data_conflicts.length > 0 && (
        <Card className={`animate-fade-up-delay-2 ${isPro ? "rounded-none border-negative/50 bg-[#2b0000]" : "border-amber-500/30 bg-amber-500/5"}`}>
          <CardHeader className={isPro ? "bg-negative/10 border-b border-negative/30 py-2 px-3" : ""}>
            <CardDescription className={isPro ? "text-negative" : ""}>VERİ UYUŞMAZLIKLARI</CardDescription>
            <CardTitle className={isPro ? "text-sm text-negative font-mono mt-0" : "mt-1"}>{isPro ? "[TBLISTE_VS_KAP_FARKLILIKLARI]" : "tbliste vs KAP Farklılıkları"}</CardTitle>
          </CardHeader>
          <CardContent className={isPro ? "p-0" : ""}>
            <div className="overflow-x-auto">
              <table className="w-full text-data-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 text-muted-foreground font-medium">Alan</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">BIST tbliste</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">KAP</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Kullanılan</th>
                  </tr>
                </thead>
                <tbody>
                  {bond.data_conflicts.map((c: any, idx: number) => (
                    <tr key={idx} className="border-b border-border/20">
                      <td className="py-2 text-foreground font-medium">{c.field}</td>
                      <td className={`py-2 font-bond-nums ${c.resolved_source === 'tbliste' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                        {c.tbliste_value}
                      </td>
                      <td className={`py-2 font-bond-nums ${c.resolved_source === 'kap' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                        {c.kap_value}
                      </td>
                      <td className="py-2">
                        <Badge variant={c.resolved_source === 'kap' ? 'default' : 'secondary'}>
                          {c.resolved_source === 'kap' ? 'KAP (güncel)' : 'tbliste (güncel)'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── KAP Bildirim Verileri ─── */}
      {bond.kap_data && (
        <Card className={`animate-fade-up-delay-2 ${isPro ? "rounded-none border-primary/50" : ""}`}>
          <CardHeader className={isPro ? "bg-primary/5 border-b border-primary/20 py-2 px-3" : ""}>
            <CardDescription className={isPro ? "text-primary/70" : ""}>KAP BİLDİRİM VERİLERİ</CardDescription>
            <CardTitle className={isPro ? "text-sm text-primary font-mono mt-0" : "mt-1"}>
              {isPro ? "[IHRAC_DETAYLARI]" : "İhraç Detayları"}
              {bond.kap_data.disclosure_url && (
                <a
                  href={bond.kap_data.disclosure_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`ml-3 font-normal hover:underline ${isPro ? "text-xs text-primary/80" : "text-data-sm text-primary"}`}
                >
                  KAP Bildirimi →
                </a>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className={`space-y-6 ${isPro ? "p-3 font-mono" : ""}`}>
            {/* İhraç Bilgileri */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-0">
                <h4 className="text-label text-muted-foreground mb-3">ARAÇ BİLGİLERİ</h4>
                {[
                  ["ISIN Kodu", bond.kap_data.isin_code],
                  ["Araç Tipi", bond.kap_data.instrument_type],
                  ["İtfa Tarihi", bond.kap_data.maturity_date ? formatDate(bond.kap_data.maturity_date) : null],
                  ["Vade (Gün)", bond.kap_data.maturity_days],
                  ["Nominal Değer", bond.kap_data.nominal_value ? `${Number(bond.kap_data.nominal_value).toLocaleString('tr-TR')} ${bond.kap_data.currency || 'TRY'}` : null],
                  ["İhraç Fiyatı", bond.kap_data.issue_price],
                  ["Faiz Tipi", bond.kap_data.interest_rate_type],
                  ["Değişken Faiz Ref.", bond.kap_data.floating_rate_reference],
                  ["Ek Getiri (%)", bond.kap_data.additional_return_pct],
                  ["Kupon Sayısı", bond.kap_data.coupon_number],
                  ["Kupon Sıklığı", bond.kap_data.coupon_frequency],
                  ["Ödeme Tipi", bond.kap_data.payment_type],
                ].map(([label, value]) => (
                  <div
                    key={label as string}
                    className="flex justify-between items-center py-2 border-b border-border/30 last:border-0"
                  >
                    <span className="text-data-sm text-muted-foreground">{label}</span>
                    <span className="font-bond-nums text-data-sm text-foreground">{value ?? "—"}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0">
                <h4 className="text-label text-muted-foreground mb-3">SATIŞ VE DERECELENDIRME</h4>
                {[
                  ["Satış Tipi", bond.kap_data.sale_type],
                  ["Satış Başlangıç", bond.kap_data.starting_date_sale ? formatDate(bond.kap_data.starting_date_sale) : null],
                  ["Satış Bitiş", bond.kap_data.ending_date_sale ? formatDate(bond.kap_data.ending_date_sale) : null],
                  ["Borsada İşlem", bond.kap_data.traded_in_exchange === true ? "Evet" : bond.kap_data.traded_in_exchange === false ? "Hayır" : null],
                  ["Aracı Kurum", bond.kap_data.intermediary_brokerage],
                  ["İhraç Tavanı", bond.kap_data.issue_limit ? `${Number(bond.kap_data.issue_limit).toLocaleString('tr-TR')} TRY` : null],
                  ["Rating Kuruluşu", bond.kap_data.issuer_rating_company],
                  ["Rating Notu", bond.kap_data.issuer_rating_note],
                  ["Rating Tarihi", bond.kap_data.issuer_rating_date ? formatDate(bond.kap_data.issuer_rating_date) : null],
                  ["Yatırım Yapılabilir", bond.kap_data.issuer_rating_investment_grade === true ? "Evet" : bond.kap_data.issuer_rating_investment_grade === false ? "Hayır" : null],
                ].map(([label, value]) => (
                  <div
                    key={label as string}
                    className="flex justify-between items-center py-2 border-b border-border/30 last:border-0"
                  >
                    <span className="text-data-sm text-muted-foreground">{label}</span>
                    <span className="font-bond-nums text-data-sm text-foreground text-right max-w-[60%]">{value ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Kupon Ödeme Planı */}
            {bond.kap_data.coupon_payments && bond.kap_data.coupon_payments.length > 0 && (
              <div>
                <h4 className="text-label text-muted-foreground mb-3">KUPON ÖDEME PLANI</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-data-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 text-muted-foreground font-medium">Kupon</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Ödeme Tarihi</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Dönemsel %</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Yıllık Basit %</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Yıllık Bileşik %</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Ödeme Tutarı</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Ödendi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bond.kap_data.coupon_payments.map((cp: any, idx: number) => (
                        <tr key={idx} className="border-b border-border/20">
                          <td className="py-2 font-bond-nums text-foreground font-medium">
                            {cp.coupon_number === "principal" ? "Anapara" : `#${cp.coupon_number}`}
                          </td>
                          <td className="py-2 font-bond-nums text-foreground">{cp.payment_date || "—"}</td>
                          <td className="py-2 font-bond-nums text-foreground text-right">
                            {cp.periodic_rate ? `%${(Number(cp.periodic_rate) / 10000).toFixed(4)}` : "—"}
                          </td>
                          <td className="py-2 font-bond-nums text-foreground text-right">
                            {cp.yearly_simple_rate ? `%${(Number(cp.yearly_simple_rate) / 10000).toFixed(4)}` : "—"}
                          </td>
                          <td className="py-2 font-bond-nums text-foreground text-right">
                            {cp.yearly_compound_rate ? `%${(Number(cp.yearly_compound_rate) / 10000).toFixed(4)}` : "—"}
                          </td>
                          <td className="py-2 font-bond-nums text-foreground text-right">
                            {cp.payment_amount ? Number(cp.payment_amount.replace(/\./g, '').replace(',', '.')).toLocaleString('tr-TR') : "—"}
                          </td>
                          <td className="py-2 text-center">
                            {cp.was_payment_made === "Yes" ? (
                              <Badge variant="default" className="text-xs">Evet</Badge>
                            ) : cp.was_payment_made === "No" ? (
                              <Badge variant="secondary" className="text-xs">Hayır</Badge>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ek Açıklama */}
            {bond.kap_data.additional_explanation && (
              <div>
                <h4 className="text-label text-muted-foreground mb-2">EK AÇIKLAMA</h4>
                <p className="text-data-sm text-muted-foreground bg-muted/50 rounded-md p-3 border border-border/30">
                  {bond.kap_data.additional_explanation}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── KAP Bildirimleri Listesi ─── */}
      {bond.kap_disclosures && bond.kap_disclosures.length > 0 && (
        <Card className={`animate-fade-up-delay-2 ${isPro ? "rounded-none border-primary/50" : ""}`}>
          <CardHeader className={isPro ? "bg-primary/5 border-b border-primary/20 py-2 px-3" : ""}>
            <CardDescription className={isPro ? "text-primary/70" : ""}>KAP BİLDİRİMLERİ</CardDescription>
            <CardTitle className={isPro ? "text-sm text-primary font-mono mt-0" : "mt-1"}>{isPro ? "[ISIN_ILGILI_TUM_BILDIRIMLER]" : "Bu ISIN ile İlgili Tüm Bildirimler"} ({bond.kap_disclosures.length})</CardTitle>
          </CardHeader>
          <CardContent className={isPro ? "p-0" : ""}>
            <div className={`space-y-0 ${isPro ? "font-mono" : ""}`}>
              {bond.kap_disclosures.slice(0, 10).map((d: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start justify-between py-3 border-b border-border/30 last:border-0 gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-data-sm text-foreground truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.publish_date ? formatDate(d.publish_date.split('T')[0]) : '—'}
                      {d.is_changed && <Badge variant="secondary" className="ml-2 text-xs">{d.is_changed}</Badge>}
                    </p>
                  </div>
                  {d.disclosure_url && (
                    <a
                      href={d.disclosure_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-data-sm text-primary hover:underline whitespace-nowrap"
                    >
                      Görüntüle →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Veri Kaynakları ─── */}
      {bond.data_sources && bond.data_sources.length > 0 && (
        <div className="animate-fade-up-delay-2 rounded-lg border border-border/50 bg-muted/30 p-4">
          <h4 className="text-label text-muted-foreground mb-3">VERİ KAYNAKLARI</h4>
          <div className="flex flex-wrap gap-4">
            {bond.data_sources.map((ds: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-data-sm">
                <div className={`w-2 h-2 rounded-full ${ds.source === 'kap' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                <span className="text-foreground font-medium">{ds.label}</span>
                {ds.updated_at && (
                  <span className="text-muted-foreground">
                    — {formatDate(ds.updated_at.split('T')[0])}
                  </span>
                )}
                {ds.disclosure_url && (
                  <div className="ml-2 flex items-center">
                    <span className="text-muted-foreground mr-1 text-[11px]">(Kaynak:</span>
                    <a
                      href={ds.disclosure_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-mono text-[11px]"
                    >
                      {ds.source === 'kap' ? `KAP Bildirim` : `BİST tbliste`} ↗
                    </a>
                    <span className="text-muted-foreground ml-1 text-[11px]">)</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
