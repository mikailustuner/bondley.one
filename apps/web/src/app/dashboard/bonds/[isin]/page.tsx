"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { FileQuestion, AlertCircle, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { api, BondDetail, TLREFRecord } from "@/lib/api-client";
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

/* ── Reusable info-row renderer ── */
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-border/20 last:border-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="font-mono-data text-[13px] text-foreground text-right max-w-[60%]">
        {value ?? "—"}
      </span>
    </div>
  );
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
  const [tlrefLatest, setTlrefLatest] = useState<TLREFRecord | null>(null);

  useEffect(() => {
    if (bond) setIsFavorite(!!bond.is_favorite);
  }, [bond]);

  useEffect(() => {
    if (!isin) {
      setError("Menkul kıymet kodu belirtilmedi");
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
      .catch((e) => setError(e?.message || "Borçlanma aracı bulunamadı"))
      .finally(() => {
        setLoading(false);
        setMetricsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isin, selectedDate]);

  useEffect(() => {
    document.title = `${isin} — Bondley`;
    return () => {
      document.title = "Bondley";
    };
  }, [isin]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.tlref
      .latest(token)
      .then(setTlrefLatest)
      .catch(() => setTlrefLatest(null));
  }, []);

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
        title="Menkul kıymet kodu belirtilmedi"
        icon={<AlertCircle className="h-7 w-7" />}
        action={{ label: "Listeye dön", href: "/dashboard/bonds" }}
      />
    );
  if (loading)
    return <div className="py-12 text-center text-muted-foreground text-[15px]">Yükleniyor...</div>;
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
        title="Borçlanma aracı bulunamadı"
        description="Belirtilen ISIN ile bir tahvil kaydı bulunamadı."
        icon={<FileQuestion className="h-7 w-7" />}
        action={{ label: "Listeye dön", href: "/dashboard/bonds" }}
      />
    );

  const topMetrics = [
    {
      label: "Son İhraç Fiyatı",
      value: formatDecimal(bond.last_issue_price, 3),
      highlight: true,
    },
    {
      label: "Son İhraç Getirisi",
      value: bond.last_issue_yield != null ? formatPercent(bond.last_issue_yield) : "—",
    },
    {
      label: "Vadeye Kalan",
      value: bond.days_to_maturity != null ? `${bond.days_to_maturity} gün` : "—",
    },
    {
      label: "Kupon Oranı",
      value: formatPercentFromDecimal(bond.next_coupon_rate, 4),
    },
  ];

  const generalInfo = [
    ["ISIN Kodu", bond.isin_code],
    ["İhraççı", bond.issuer],
    ...(bond.fund_user ? [["Fon Kullanıcısı", bond.fund_user]] : []),
    ...(bond.source_institution ? [["Kaynak Kuruluş", bond.source_institution]] : []),
    ["İhraç Türü", bond.issuance_type],
    ["Getiri Türü", bond.yield_type],
    ["MK Türü", bond.security_type],
    ["Kupon Sıklığı", bond.coupon_frequency],
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
      "Son TLREF (Gecelik Faiz) %",
      tlrefLatest?.daily_rate != null ? formatPercentFromDecimal(tlrefLatest.daily_rate * 365, 4) : "—",
    ],
    [
      "Son TLREFK (Endeks)",
      tlrefLatest?.index_value != null ? formatDecimal(tlrefLatest.index_value, 5, 5) : "—",
    ],
    [
      "Hesaplamada Kullanılan TLREF Tarihi",
      bond.calculated_metrics?.tlref_rate_date ? formatDate(bond.calculated_metrics.tlref_rate_date) : "—",
    ],
    [
      "Toplam İhraç Tutarı",
      bond.total_issue_amount != null
        ? `${formatDecimal(bond.total_issue_amount, 0)} (x1000 ${bond.currency})`
        : "—",
    ],
  ];

  const formulaInfo = [
    ["İşlemiş Faiz/Kira", bond.accrued_interest_text],
    ["Temiz Fiyat", bond.clean_price_text],
    ["Kirli Fiyat", bond.dirty_price_formula],
    ["Takas Fiyatı", bond.settlement_price_formula],
    ["Getiri", bond.yield_formula],
    ["Bileşik Getiri", bond.compound_yield_formula],
  ];

  return (
    <div className="space-y-6">
      {/* ═══ Hero Header ═══ */}
      <div className="animate-fade-up">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-2 text-[13px]">
            <li>
              <Link href="/dashboard/bonds" className="text-muted-foreground hover:text-primary transition-colors">
                Borçlanma Araçları
              </Link>
            </li>
            <li className="text-muted-foreground/30" aria-hidden>/</li>
            <li aria-current="page" className="font-mono-data text-foreground">{bond.isin_code}</li>
          </ol>
        </nav>

        {/* ISIN Hero */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-display-md font-mono-data text-foreground">{bond.isin_code}</h1>
              <Badge>{bond.currency}</Badge>
              {!bond.is_active && <Badge variant="destructive">Pasif</Badge>}
            </div>
            {bond.fund_user ? (
              <p className="text-[15px] text-muted-foreground mt-1">
                İhraççı VKŞ: <span className="font-medium text-foreground">{bond.issuer || "Bilinmiyor"}</span> · Fon Kullanıcısı: <span className="font-medium text-foreground">{bond.fund_user}</span>
              </p>
            ) : (
              <p className="text-[15px] text-muted-foreground mt-1">
                {bond.issuer || "Bilinmiyor"} · {bond.security_type ? bond.security_type.split("/")[0].trim() : "—"}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-xl"
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
              <Star className={`h-4 w-4 ${isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
              {isFavorite ? "Favori" : "Favorilere ekle"}
            </Button>
            <div className="flex items-center gap-1">
              {prevIsin ? (
                <Link href={`/dashboard/bonds/${prevIsin}`}>
                  <Button variant="outline" size="sm" className="rounded-xl"><ChevronLeft className="h-4 w-4" /></Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" className="rounded-xl" disabled><ChevronLeft className="h-4 w-4" /></Button>
              )}
              {nextIsin ? (
                <Link href={`/dashboard/bonds/${nextIsin}`}>
                  <Button variant="outline" size="sm" className="rounded-xl"><ChevronRight className="h-4 w-4" /></Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" className="rounded-xl" disabled><ChevronRight className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Top Metrics ═══ */}
      <div className="grid gap-4 md:grid-cols-4 animate-fade-up">
        {topMetrics.map((m) => (
          <div key={m.label} className="rounded-3xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[12px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-2.5">{m.label}</div>
            <div className={`font-mono-data text-[1.75rem] font-bold leading-none tracking-tight ${m.highlight ? "text-primary" : "text-foreground"}`}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Date Selector ═══ */}
      <div className="animate-fade-up rounded-3xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-medium text-muted-foreground">Hesaplama tarihi</span>
          <input
            id="bond-settlement-date"
            type="date"
            value={selectedDate}
            max={todayISO()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 font-mono-data text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "Bugün", fn: todayISO },
              { label: "Son iş günü", fn: lastBusinessDayISO },
              { label: "1 hafta", fn: weekAgoISO },
              { label: "1 ay", fn: monthAgoISO },
            ].map((btn) => (
              <Button
                key={btn.label}
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(btn.fn())}
                className="text-[12px] rounded-xl h-8"
              >
                {btn.label}
              </Button>
            ))}
          </div>
        </div>
        {!bond.calculated_metrics && !metricsLoading && (
          <div className="flex items-center gap-2 mt-3 text-[13px] text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            Bu tarih için piyasa verisi yok
          </div>
        )}
        {metricsLoading && (
          <span className="text-[13px] text-muted-foreground mt-3 block">Hesaplanıyor...</span>
        )}
      </div>

      {/* ═══ Calculated Metrics ═══ */}
      {bond.calculated_metrics && !metricsLoading && (
        <Card className="animate-fade-up border-primary/20 bg-primary/[0.02]">
          <CardHeader>
            <CardDescription>Hesaplanan Metrikler</CardDescription>
            <CardTitle className="mt-1">Kirli Fiyat, Getiri ve Risk — {formatDate(selectedDate)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Kirli Fiyat", value: formatDecimal(bond.calculated_metrics.dirty_price, 8, 8), primary: true },
                { label: "Birikimiş Faiz", value: formatDecimal(bond.calculated_metrics.accrued_interest, 8, 8) },
                { label: "Oran Değişimi (Günlük %)", value: bond.calculated_metrics.rate_change_today_pct != null ? formatPercent(bond.calculated_metrics.rate_change_today_pct) : "—" },
                { label: "Temiz Fiyat", value: formatDecimal(bond.calculated_metrics.clean_price_used, 8, 8) },
                ...(bond.calculated_metrics.annual_reference_rate != null ? [{ label: "Yıllık Gösterge Faiz", value: formatPercentFromDecimal(bond.calculated_metrics.annual_reference_rate, 4) }] : []),
                ...(bond.calculated_metrics.annual_coupon_rate != null ? [{ label: "Yıllık Kupon Faiz", value: formatPercentFromDecimal(bond.calculated_metrics.annual_coupon_rate, 4) }] : []),
                ...(bond.calculated_metrics.periodic_coupon_rate != null ? [{ label: "Dönemsel Kupon Faiz", value: formatPercentFromDecimal(bond.calculated_metrics.periodic_coupon_rate, 4) }] : []),
                ...(bond.calculated_metrics.yield_to_maturity != null ? [{ label: "Vadeye Kadar Getiri (YTM)", value: formatPercentFromDecimal(bond.calculated_metrics.yield_to_maturity, 4) }] : []),
                ...(bond.calculated_metrics.return_to_date_pct != null ? [{ label: `Başlangıçtan Seçilen Tarihe Getiri`, value: formatPercent(bond.calculated_metrics.return_to_date_pct) }] : []),
                ...(bond.calculated_metrics.spread != null ? [{ label: "Spread", value: formatPercentFromDecimal(bond.calculated_metrics.spread, 4) }] : []),
                ...(bond.calculated_metrics.modified_duration != null ? [{ label: "Modifiye Dürasyon", value: formatDecimal(bond.calculated_metrics.modified_duration, 4) }] : []),
                ...(bond.calculated_metrics.macaulay_duration != null ? [{ label: "Macaulay Dürasyon", value: formatDecimal(bond.calculated_metrics.macaulay_duration, 4) }] : []),
                ...(bond.calculated_metrics.convexity != null ? [{ label: "Konveksite", value: formatDecimal(bond.calculated_metrics.convexity, 4) }] : []),
                ...(bond.calculated_metrics.coupon_payment_amount != null ? [{ label: "Kupon Ödeme Tutarı", value: formatDecimal(bond.calculated_metrics.coupon_payment_amount, 4) }] : []),
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/50 bg-card p-4">
                  <div className="text-[12px] font-medium text-muted-foreground/70 mb-1.5">{item.label}</div>
                  <div className={`font-mono-data text-[1.25rem] font-bold leading-tight ${(item as any).primary ? "text-primary" : "text-foreground"}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            {bond.calculated_metrics.return_to_date_used_fallback_price && (
              <p className="text-[12px] text-muted-foreground mt-3">
                Veri bulunamadığı için 100 olarak kabul edilmiştir.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ Scenario ═══ */}
      {bond.calculated_metrics && !metricsLoading && (
        <Card className="animate-fade-up">
          <CardHeader>
            <CardDescription>Senaryo Analizi</CardDescription>
            <CardTitle className="mt-1">TLREF Değişimi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-[13px] text-muted-foreground block mb-3">
                TLREF şoku: <span className="font-mono-data font-semibold text-foreground">{scenarioShockBp > 0 ? "+" : ""}{scenarioShockBp} bp</span>
              </label>
              <input
                type="range"
                min={-100}
                max={100}
                step={5}
                value={scenarioShockBp}
                onChange={(e) => setScenarioShockBp(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>-100 bp</span>
                <span>0</span>
                <span>+100 bp</span>
              </div>
            </div>
            {baseScenarioMetrics && (
              <div className="rounded-2xl bg-secondary/30 border border-border/30 p-4 text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">Anlık önizleme:</span>{" "}
                Tahmini kirli fiyat{" "}
                <span className="font-mono-data text-foreground">
                  {formatDecimal(
                    baseScenarioMetrics.current_dirty_price *
                    (1 - (baseScenarioMetrics.modified_duration ?? 0) * (scenarioShockBp / 10000)),
                    4, 4
                  )}
                </span>
                , değişim{" "}
                <span className={(baseScenarioMetrics.modified_duration ?? 0) * scenarioShockBp <= 0 ? "text-negative" : "text-positive"}>
                  {formatPercent(-((baseScenarioMetrics.modified_duration ?? 0) * (scenarioShockBp / 10000)) * 100)}
                </span>
                {" · "}YTM{" "}
                <span className="font-mono-data text-foreground">
                  {formatPercentFromDecimal(baseScenarioMetrics.current_ytm + scenarioShockBp / 10000, 4)}
                </span>
              </div>
            )}
            {scenarioLoading && (
              <p className="text-[13px] text-muted-foreground">Hesaplanıyor...</p>
            )}
            {!scenarioLoading && scenarioResult && (
              <div className="rounded-2xl border border-border/50 bg-card p-4">
                <p className="text-[13px] text-foreground">
                  TLREF {scenarioResult.shock_bp > 0 ? "+" : ""}{scenarioResult.shock_bp} bp → Tahmini
                  kirli fiyat: <span className="font-mono-data">{formatDecimal(scenarioResult.new_dirty_price_approx, 4, 4)}</span>, değişim:{" "}
                  <span className={scenarioResult.price_change_pct >= 0 ? "text-positive" : "text-negative"}>
                    {formatPercent(scenarioResult.price_change_pct)}
                  </span>
                </p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Tahmini YTM: {formatPercentFromDecimal(scenarioResult.new_ytm_approx, 4)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No metrics fallback */}
      {!bond.calculated_metrics && !metricsLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Hesaplanan Metrikler</CardTitle>
            <CardDescription>
              {selectedDate === todayISO() ? "Bugün için" : `${formatDate(selectedDate)} tarihi için`}{" "}piyasa verisi bulunamadı
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-5 bg-secondary/30 border border-border/30 rounded-2xl text-center">
              <p className="text-[14px] text-muted-foreground">
                {selectedDate === todayISO()
                  ? "Bugün için piyasa verisi henüz yüklenmemiş veya mevcut değil."
                  : `${formatDate(selectedDate)} tarihi için piyasa verisi bulunmamaktadır.`}
              </p>
              <p className="text-[12px] text-muted-foreground mt-2">
                Lütfen başka bir tarih seçin veya veri yükleme işlemini bekleyin.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fallback market data notice */}
      {bond.calculated_metrics?.used_fallback_market_data && bond.calculated_metrics?.market_data_date && (
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-[13px] text-muted-foreground animate-fade-up">
          <span className="font-medium text-amber-600 dark:text-amber-400">Not:</span>{" "}
          Seçilen tarih için piyasa verisi henüz mevcut değil.{" "}
          <span className="font-mono-data">{formatDate(bond.calculated_metrics.market_data_date)}</span>{" "}
          tarihli en güncel veri kullanılmaktadır.
        </div>
      )}

      {/* ═══ Info Cards — 2 column grid ═══ */}
      <div className="grid gap-5 lg:grid-cols-2 animate-fade-up-delay-1">
        <Card>
          <CardHeader>
            <CardDescription>Genel Bilgiler</CardDescription>
            <CardTitle className="mt-1">Genel Detaylar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {generalInfo.map(([label, value]) => (
                <InfoRow key={label} label={label as string} value={value as string} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Tarih Bilgileri</CardDescription>
            <CardTitle className="mt-1">İhraç ve Vade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {dateInfo.map(([label, value]) => (
                <InfoRow key={label} label={label as string} value={value as string} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 animate-fade-up-delay-2">
        <Card>
          <CardHeader>
            <CardDescription>Finansal Veriler</CardDescription>
            <CardTitle className="mt-1">Fiyat ve Getiri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {financialInfo.map(([label, value]) => (
                <InfoRow key={label} label={label as string} value={value as string} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Hesaplama Yöntemleri</CardDescription>
            <CardTitle className="mt-1">Formül ve Konvansiyon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {formulaInfo.map(([label, value]) => (
                <InfoRow key={label} label={label as string} value={value as string} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Remarks ═══ */}
      {bond.remarks && (
        <Card className="animate-fade-up-delay-2">
          <CardHeader>
            <CardDescription>Notlar</CardDescription>
            <CardTitle className="mt-1">Açıklamalar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-[14px] text-muted-foreground">{bond.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* ═══ Data Conflicts ═══ */}
      {bond.data_conflicts && bond.data_conflicts.length > 0 && (
        <Card className="animate-fade-up-delay-2 border-amber-500/20 bg-amber-500/[0.02]">
          <CardHeader>
            <CardDescription>Veri Uyuşmazlıkları</CardDescription>
            <CardTitle className="mt-1">tbliste vs KAP Farklılıkları</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2.5 text-muted-foreground font-medium">Alan</th>
                    <th className="text-left py-2.5 text-muted-foreground font-medium">BIST tbliste</th>
                    <th className="text-left py-2.5 text-muted-foreground font-medium">KAP</th>
                    <th className="text-left py-2.5 text-muted-foreground font-medium">Kullanılan</th>
                  </tr>
                </thead>
                <tbody>
                  {bond.data_conflicts.map((c: any, idx: number) => (
                    <tr key={idx} className="border-b border-border/20">
                      <td className="py-2.5 text-foreground font-medium">{c.field}</td>
                      <td className={`py-2.5 font-mono-data ${c.resolved_source === 'tbliste' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{c.tbliste_value}</td>
                      <td className={`py-2.5 font-mono-data ${c.resolved_source === 'kap' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{c.kap_value}</td>
                      <td className="py-2.5">
                        <Badge variant={c.resolved_source === 'kap' ? 'default' : 'secondary'}>{c.resolved_source === 'kap' ? 'KAP (güncel)' : 'tbliste (güncel)'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ KAP Data ═══ */}
      {bond.kap_data && (
        <Card className="animate-fade-up-delay-2">
          <CardHeader>
            <CardDescription>KAP Bildirim Verileri</CardDescription>
            <CardTitle className="mt-1">
              İhraç Detayları
              {bond.kap_data.disclosure_url && (
                <a href={bond.kap_data.disclosure_url} target="_blank" rel="noopener noreferrer" className="ml-3 text-[13px] font-normal text-primary hover:underline">
                  KAP Bildirimi →
                </a>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-0">
                <h4 className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">Araç Bilgileri</h4>
                {[
                  ["ISIN Kodu", bond.kap_data.isin_code],
                  ["Araç Tipi", bond.kap_data.instrument_type],
                  ...(bond.kap_data.fund_user ? [["Fon Kullanıcısı", bond.kap_data.fund_user]] : []),
                  ...(bond.kap_data.source_institution ? [["Kaynak Kuruluş", bond.kap_data.source_institution]] : []),
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
                  <InfoRow key={label as string} label={label as string} value={value as string} />
                ))}
              </div>
              <div className="space-y-0">
                <h4 className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">Satış ve Derecelendirme</h4>
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
                  <InfoRow key={label as string} label={label as string} value={value as string} />
                ))}
              </div>
            </div>

            {/* Coupon Payments */}
            {bond.kap_data.coupon_payments && bond.kap_data.coupon_payments.length > 0 && (
              <div>
                <h4 className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">Kupon Ödeme Planı</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2.5 text-muted-foreground font-medium">Kupon</th>
                        <th className="text-left py-2.5 text-muted-foreground font-medium">Ödeme Tarihi</th>
                        <th className="text-right py-2.5 text-muted-foreground font-medium">Dönemsel %</th>
                        <th className="text-right py-2.5 text-muted-foreground font-medium">Yıllık Basit %</th>
                        <th className="text-right py-2.5 text-muted-foreground font-medium">Yıllık Bileşik %</th>
                        <th className="text-right py-2.5 text-muted-foreground font-medium">Ödeme Tutarı</th>
                        <th className="text-center py-2.5 text-muted-foreground font-medium">Ödendi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bond.kap_data.coupon_payments.map((cp: any, idx: number) => (
                        <tr key={idx} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                          <td className="py-2.5 font-mono-data text-foreground font-medium">
                            {cp.coupon_number === "principal" ? "Anapara" : `#${cp.coupon_number}`}
                          </td>
                          <td className="py-2.5 font-mono-data text-foreground">{cp.payment_date || "—"}</td>
                          <td className="py-2.5 font-mono-data text-foreground text-right">
                            {cp.periodic_rate ? `%${(Number(cp.periodic_rate) / 10000).toFixed(4)}` : "—"}
                          </td>
                          <td className="py-2.5 font-mono-data text-foreground text-right">
                            {cp.yearly_simple_rate ? `%${(Number(cp.yearly_simple_rate) / 10000).toFixed(4)}` : "—"}
                          </td>
                          <td className="py-2.5 font-mono-data text-foreground text-right">
                            {cp.yearly_compound_rate ? `%${(Number(cp.yearly_compound_rate) / 10000).toFixed(4)}` : "—"}
                          </td>
                          <td className="py-2.5 font-mono-data text-foreground text-right">
                            {cp.payment_amount ? Number(cp.payment_amount.replace(/\./g, '').replace(',', '.')).toLocaleString('tr-TR') : "—"}
                          </td>
                          <td className="py-2.5 text-center">
                            {cp.was_payment_made === "Yes" ? (
                              <Badge variant="default" className="text-[10px]">Evet</Badge>
                            ) : cp.was_payment_made === "No" ? (
                              <Badge variant="secondary" className="text-[10px]">Hayır</Badge>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {bond.kap_data.additional_explanation && (
              <div>
                <h4 className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">Ek Açıklama</h4>
                <p className="text-[13px] text-muted-foreground bg-secondary/30 rounded-2xl p-4 border border-border/30">
                  {bond.kap_data.additional_explanation}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ KAP Disclosures List ═══ */}
      {bond.kap_disclosures && bond.kap_disclosures.length > 0 && (
        <Card className="animate-fade-up-delay-2">
          <CardHeader>
            <CardDescription>KAP Bildirimleri</CardDescription>
            <CardTitle className="mt-1">Bu ISIN ile İlgili Tüm Bildirimler ({bond.kap_disclosures.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {bond.kap_disclosures.slice(0, 10).map((d: any, idx: number) => (
                <div key={idx} className="flex items-start justify-between py-3 border-b border-border/20 last:border-0 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground truncate">{d.title}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      {d.publish_date ? formatDate(d.publish_date.split('T')[0]) : '—'}
                      {d.is_changed && <Badge variant="secondary" className="ml-2 text-[10px]">{d.is_changed}</Badge>}
                    </p>
                  </div>
                  {d.disclosure_url && (
                    <a href={d.disclosure_url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-primary hover:underline whitespace-nowrap shrink-0">
                      Görüntüle →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Data Sources ═══ */}
      {bond.data_sources && bond.data_sources.length > 0 && (
        <div className="animate-fade-up-delay-2 rounded-3xl border border-border/50 bg-secondary/20 p-5">
          <h4 className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">Veri Kaynakları</h4>
          <div className="flex flex-wrap gap-4">
            {bond.data_sources.map((ds: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-[13px]">
                <div className={`w-2 h-2 rounded-full ${ds.source === 'kap' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                <span className="text-foreground font-medium">{ds.label}</span>
                {ds.updated_at && (
                  <span className="text-muted-foreground">— {formatDate(ds.updated_at.split('T')[0])}</span>
                )}
                {ds.disclosure_url && (
                  <a href={ds.disclosure_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono-data text-[11px]">
                    {ds.source === 'kap' ? 'KAP' : 'BİST'} ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
