"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Database,
  FileJson,
  Info,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, VerifiedInstrument, VerifiedValuationResponse } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDate, formatDecimal, formatPercentFromDecimal } from "@/lib/utils";
import { tr } from "@/locales/tr";

const DEFAULT_CLEAN_PRICE = "100";

function turkeyBusinessDateISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const day = date.getUTCDay();
  if (day === 0) date.setUTCDate(date.getUTCDate() - 2);
  if (day === 6) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function displayNumber(value: string | null | undefined, digits = 4): string {
  if (value == null) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

function DetailRow({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-5 py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`max-w-[62%] text-right text-xs font-semibold ${numeric ? "font-mono-data" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function ResultMetric({
  label,
  value,
  suffix,
  featured = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        featured
          ? "border-primary/15 bg-primary/[0.065]"
          : "border-border/60 bg-card/55"
      }`}
    >
      <p className="eyebrow">{label}</p>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`metric-value ${featured ? "text-3xl text-primary" : "text-2xl"}`}>
          {value}
        </span>
        {suffix && <span className="text-xs font-semibold text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export default function VerifiedInstrumentDetail({
  params,
}: {
  params: Promise<{ isin: string }>;
}) {
  const { isin } = use(params);
  const [instrument, setInstrument] = useState<VerifiedInstrument | null>(null);
  const [benchmarks, setBenchmarks] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [valuation, setValuation] = useState<VerifiedValuationResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [assumptionOpen, setAssumptionOpen] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const settlementDate = useMemo(() => turkeyBusinessDateISO(), []);

  useEffect(() => {
    document.title = `${isin} — Bondley`;
    const token = getToken();
    if (!token) {
      setLoadError("Bu ekranı görüntülemek için giriş yapmalısınız.");
      setLoading(false);
      return;
    }
    Promise.all([api.verified.get(token, isin), api.verified.benchmarks(token, undefined, 10)])
      .then(([detail, benchmarkResult]) => {
        setInstrument(detail);
        setNote(detail.note_text || "");
        const latest: Record<string, string | null> = {};
        for (const observation of benchmarkResult.items) {
          if (!(observation.benchmark in latest)) {
            latest[observation.benchmark] = observation.published_annual_rate_pct;
          }
        }
        setBenchmarks(latest);
      })
      .catch((reason) =>
        setLoadError(reason instanceof Error ? reason.message : "Kıymet yüklenemedi."),
      )
      .finally(() => setLoading(false));
  }, [isin]);

  const benchmarkNames = useMemo(() => {
    const ast = instrument?.term_rule_ast as {
      benchmarks?: Array<{ name?: string }>;
    } | undefined;
    return ast?.benchmarks?.map((item) => item.name).filter(Boolean) ?? [];
  }, [instrument]);
  const requiredBenchmark =
    instrument?.instrument_family === "PARTICIPATION"
      ? "TLREFK"
      : benchmarkNames.some((name) => name?.includes("TLREFK"))
        ? "TLREFK"
        : benchmarkNames.some((name) => name?.includes("TLREF"))
          ? "TLREF"
          : null;
  const requiresCpi = benchmarkNames.includes("CPI_REFERENCE_INDEX");

  useEffect(() => {
    if (!instrument?.quality.valuation_eligible) return;
    const token = getToken();
    if (!token) return;

    let active = true;
    setCalculating(true);
    setValuation(null);
    setCalculationError(null);

    api.verified
      .value(token, {
        isin,
        settlement_date: settlementDate,
        quote_type: "CLEAN_PRICE",
        quote_value: DEFAULT_CLEAN_PRICE,
        quote_source: "SYSTEM_NOMINAL_100",
      })
      .then((result) => {
        if (active) setValuation(result);
      })
      .catch((reason) => {
        if (active) {
          setCalculationError(
            reason instanceof Error ? reason.message : "Otomatik değerleme hazırlanamadı.",
          );
        }
      })
      .finally(() => {
        if (active) setCalculating(false);
      });

    return () => {
      active = false;
    };
  }, [instrument?.quality.valuation_eligible, instrument?.version_id, isin, settlementDate]);

  const toggleFavorite = async () => {
    const token = getToken();
    if (!token || !instrument) return;
    if (instrument.is_favorite) {
      await api.verified.removeFavorite(token, isin);
    } else {
      await api.verified.addFavorite(token, isin);
    }
    setInstrument({ ...instrument, is_favorite: !instrument.is_favorite });
  };

  const saveNote = async () => {
    const token = getToken();
    if (!token || !note.trim()) return;
    setSavingNote(true);
    try {
      await api.verified.upsertNote(token, isin, note.trim());
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async () => {
    const token = getToken();
    if (!token || !note) return;
    setSavingNote(true);
    try {
      await api.verified.deleteNote(token, isin);
      setNote("");
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-36 w-full rounded-[28px]" />
        <Skeleton className="h-72 w-full rounded-[32px]" />
        <div className="grid gap-5 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-56 rounded-[28px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!instrument || loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Kıymet açılamadı</AlertTitle>
        <AlertDescription>{loadError || "Kayıt bulunamadı."}</AlertDescription>
      </Alert>
    );
  }

  const fields = instrument.fields;
  const result = valuation?.result;
  const failure = valuation?.failure;
  const couponDetails = result?.intermediates?.coupon_rates as
    | {
        calculation_as_of?: string;
        assumptions?: string[];
        period_start?: string;
        period_end?: string;
      }
    | undefined;
  const publishedCouponRate =
    instrument.next_coupon_rate_pct != null &&
    Number(instrument.next_coupon_rate_pct) > 0
      ? `%${displayNumber(instrument.next_coupon_rate_pct, 4)}`
      : "Henüz ilan edilmedi";
  const couponStatusLabel =
    result?.coupon_rate_status === "PUBLISHED"
      ? tr.dashboard.bondDetails.calculatedMetrics.publishedCouponStatus
      : result?.coupon_rate_status === "CALCULATED_FINAL"
        ? tr.dashboard.bondDetails.calculatedMetrics.calculatedFinalCouponStatus
        : tr.dashboard.bondDetails.calculatedMetrics.indicativeCouponStatus;

  return (
    <main className="space-y-6 lg:space-y-8">
      <header>
        <Link
          href="/dashboard/bonds"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kıymet evrenine dön
        </Link>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={instrument.quality.valuation_eligible ? "positive" : "destructive"}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {instrument.quality.valuation_eligible ? "Değerlemeye hazır" : "İnceleme gerekli"}
              </Badge>
              <Badge variant="outline">{instrument.currency}</Badge>
              {instrument.instrument_family === "PARTICIPATION" && (
                <Badge variant="secondary">Katılım · TLREFK</Badge>
              )}
            </div>
            <h1 className="font-mono-data mt-4 break-all text-3xl tracking-tight sm:text-[2.7rem]">
              {instrument.isin}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {instrument.issuer || "İhraççı belirtilmemiş"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void toggleFavorite()}
            className="self-start rounded-full bg-card"
          >
            <Star
              className={`h-4 w-4 ${
                instrument.is_favorite ? "fill-amber-400 text-amber-500" : "text-muted-foreground"
              }`}
            />
            {instrument.is_favorite ? "Favoride" : "Favoriye ekle"}
          </Button>
        </div>
      </header>

      {!instrument.quality.valuation_eligible && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Otomatik değerleme kullanılamıyor</AlertTitle>
          <AlertDescription>
            Kaynak terimleri “{instrument.quality.parse_status}” durumunda. Belirsiz bir sözleşme
            varsayımı üretmemek için yalnız doğrulanmış kaynak bilgileri gösteriliyor.
          </AlertDescription>
        </Alert>
      )}

      <section
        className="data-surface overflow-hidden rounded-3xl"
        aria-label="Otomatik değerleme"
      >
        <div className="border-b border-border/60 px-5 py-5 sm:px-7 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {tr.dashboard.bondDetails.calculatedMetrics.automaticTitle}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {tr.dashboard.bondDetails.calculatedMetrics.automaticSubtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-expanded={assumptionOpen}
              onClick={() => setAssumptionOpen((value) => !value)}
              className="assumption-chip inline-flex h-10 items-center justify-center gap-2 self-start rounded-full px-4 text-xs font-semibold hover:bg-primary/10 sm:self-auto"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              {tr.dashboard.bondDetails.calculatedMetrics.cleanPriceAssumption}
              <Info className="h-3.5 w-3.5 opacity-70" />
            </button>
          </div>

          {assumptionOpen && (
            <div className="mt-4 rounded-2xl border border-border bg-muted/45 p-4 text-xs leading-5 text-muted-foreground">
              {tr.dashboard.bondDetails.calculatedMetrics.cleanPriceAssumptionDescription}
            </div>
          )}
        </div>

        <div className="p-5 sm:p-7 lg:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5" />
              Valör: <strong className="font-mono-data text-foreground">{formatDate(settlementDate)}</strong>
            </span>
            <span>
              Referans: <strong className="text-foreground">{requiredBenchmark || (requiresCpi ? "TÜFE" : "Sabit oran")}</strong>
            </span>
            {calculating && (
              <span className="inline-flex items-center gap-2 text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Hesaplanıyor
              </span>
            )}
          </div>

          {calculating && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="rounded-2xl border border-border bg-muted/35 p-5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-4 h-9 w-32" />
                </div>
              ))}
            </div>
          )}

          {!calculating && result && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="widget-blue rounded-2xl border border-primary/20 p-5">
                  <p className="eyebrow text-primary">
                    {tr.dashboard.bondDetails.calculatedMetrics.periodicCouponRate}
                  </p>
                  <p className="metric-value mt-4 text-3xl text-primary">
                    {formatPercentFromDecimal(result.periodic_coupon_rate, 4)}
                  </p>
                  <p className="mt-3 text-[11px] font-medium text-primary">{couponStatusLabel}</p>
                </div>
                <div className="widget-green rounded-2xl border border-border p-5">
                  <p className="eyebrow">
                    {tr.dashboard.bondDetails.calculatedMetrics.annualSimpleInterest}
                  </p>
                  <p className="metric-value mt-4 text-3xl">
                    {formatPercentFromDecimal(result.annual_simple_coupon_rate, 4)}
                  </p>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Dönemsel kuponun yıllık basit eşdeğeri
                  </p>
                </div>
                <div className="widget-purple rounded-2xl border border-border p-5">
                  <p className="eyebrow">
                    {tr.dashboard.bondDetails.calculatedMetrics.annualCompoundInterest}
                  </p>
                  <p className="metric-value mt-4 text-3xl">
                    {formatPercentFromDecimal(result.annual_compound_coupon_rate, 4)}
                  </p>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Dönemsel kuponun bileşik eşdeğeri
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="eyebrow">
                    {tr.dashboard.bondDetails.calculatedMetrics.ytm}
                  </p>
                  <p className="metric-value mt-4 text-3xl">
                    {formatPercentFromDecimal(result.annual_yield, 4)}
                  </p>
                  <p className="mt-3 text-[11px] text-muted-foreground">Temiz fiyat 100 üzerinden</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="eyebrow">
                    {tr.dashboard.bondDetails.calculatedMetrics.dirtyPrice}
                  </p>
                  <p className="metric-value mt-4 text-3xl">
                    {displayNumber(result.dirty_price)}
                  </p>
                  <p className="mt-3 text-[11px] text-muted-foreground">İşlemiş tutar dahil</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="eyebrow">
                    {tr.dashboard.bondDetails.infoCards.methods.accrued}
                  </p>
                  <p className="metric-value mt-4 text-3xl">
                    {displayNumber(result.accrued_amount)}
                  </p>
                  <p className="mt-3 text-[11px] text-muted-foreground">Valör tarihindeki birikim</p>
                </div>
              </div>
              {result.coupon_rate_status === "INDICATIVE" && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-4 text-xs leading-5 text-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p>{tr.dashboard.bondDetails.calculatedMetrics.unfinishedCouponPeriod}</p>
                    {couponDetails?.calculation_as_of && (
                      <p className="mt-1 font-medium">
                        {tr.dashboard.bondDetails.calculatedMetrics.couponAsOf.replace(
                          "{date}",
                          formatDate(couponDetails.calculation_as_of),
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {result.coupon_rate_confidence === "ASSUMPTION_REQUIRED" && (
                <div className="mt-3 flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-xs leading-5 text-foreground">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p>{tr.dashboard.bondDetails.calculatedMetrics.spreadAnnualityAssumption}</p>
                </div>
              )}
            </>
          )}

          {!calculating && (calculationError || failure) && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    Otomatik değerleme hazırlanamadı
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {calculationError || failure?.message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {result && (
        <section className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]" aria-label="Risk ve nakit akışları">
          <article className="data-surface rounded-[28px] p-5 sm:p-6">
            <p className="eyebrow">Risk görünümü</p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">Fiyat duyarlılığı</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <ResultMetric
                label="Modified duration"
                value={displayNumber(result.modified_duration, 6)}
                featured
              />
              <ResultMetric
                label="Macaulay duration"
                value={displayNumber(result.macaulay_duration, 6)}
              />
              <ResultMetric label="Convexity" value={displayNumber(result.convexity, 6)} />
              <ResultMetric label="Temiz fiyat" value={displayNumber(result.clean_price)} />
            </div>
            <p className="mt-5 rounded-2xl bg-muted/55 p-4 text-xs leading-5 text-muted-foreground">
              {tr.dashboard.bondDetails.calculatedMetrics.theoreticalNotice}
            </p>
          </article>

          <article className="data-surface overflow-hidden rounded-[28px]">
            <div className="flex items-center justify-between px-5 py-5 sm:px-6">
              <div>
                <p className="eyebrow">Projeksiyon</p>
                <h2 className="mt-1.5 text-lg font-semibold tracking-tight">Nakit akışları</h2>
              </div>
              <Badge variant="outline">{result.cash_flows.length} ödeme</Badge>
            </div>
            <div className="overflow-x-auto border-t border-border/60">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground">
                    <th className="px-6 py-3.5">Ödeme tarihi</th>
                    <th className="px-4 py-3.5 text-right">Kupon</th>
                    <th className="px-4 py-3.5 text-right">Anapara</th>
                    <th className="px-4 py-3.5 text-right">Toplam</th>
                    <th className="px-6 py-3.5 text-right">Bugünkü değer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/55">
                  {result.cash_flows.map((flow, index) => (
                    <tr key={`${flow.payment_date}-${index}`} className="hover:bg-muted/25">
                      <td className="font-mono-data px-6 py-3.5 text-xs">
                        {formatDate(flow.payment_date)}
                      </td>
                      <td className="font-mono-data px-4 py-3.5 text-right text-xs">
                        {displayNumber(flow.coupon_amount)}
                      </td>
                      <td className="font-mono-data px-4 py-3.5 text-right text-xs">
                        {displayNumber(flow.principal_amount)}
                      </td>
                      <td className="font-mono-data px-4 py-3.5 text-right text-xs font-bold">
                        {displayNumber(flow.total_amount)}
                      </td>
                      <td className="font-mono-data px-6 py-3.5 text-right text-xs text-primary">
                        {displayNumber(flow.present_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-3">
        <article className="data-surface rounded-[28px] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Database className="h-4 w-4" />
            </span>
            <div>
              <p className="eyebrow">Kaynak</p>
              <h2 className="mt-0.5 text-base font-semibold">Veri izi</h2>
            </div>
          </div>
          <dl className="hairline-list mt-4">
            <DetailRow label="Dosya" value={<span className="break-all">{instrument.source.filename || "—"}</span>} />
            <DetailRow label="Veri tarihi" value={formatDate(instrument.source.effective_date)} numeric />
            <DetailRow
              label="Tazelik"
              value={instrument.source.freshness_status === "CURRENT" ? "Güncel" : "Önceki iş günü"}
            />
            <DetailRow label="Kaynak satırı" value={String(instrument.source.source_row)} numeric />
          </dl>
        </article>

        <article className="data-surface rounded-[28px] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div>
              <p className="eyebrow">Sözleşme</p>
              <h2 className="mt-0.5 text-base font-semibold">Temel tarihler</h2>
            </div>
          </div>
          <dl className="hairline-list mt-4">
            <DetailRow
              label={tr.dashboard.bondDetails.infoCards.dates.firstIssue}
              value={formatDate(instrument.first_issue_date)}
              numeric
            />
            <DetailRow
              label={tr.dashboard.bondDetails.infoCards.dates.maturity}
              value={formatDate(instrument.maturity_date)}
              numeric
            />
            <DetailRow
              label={tr.dashboard.bondDetails.infoCards.dates.daysToMaturity}
              value={instrument.days_to_maturity == null ? "—" : `${formatDecimal(instrument.days_to_maturity, 0)} gün`}
              numeric
            />
            <DetailRow
              label={tr.dashboard.bondDetails.infoCards.general.couponFreq}
              value={String(instrument.coupon_frequency ?? "—")}
              numeric
            />
            <DetailRow
              label={tr.dashboard.bondDetails.infoCards.general.dayCount}
              value={String(fields.day_count_convention || "—")}
            />
          </dl>
        </article>

        <article className="data-surface rounded-[28px] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-600">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="eyebrow">Referans</p>
              <h2 className="mt-0.5 text-base font-semibold">Oran yapısı</h2>
            </div>
          </div>
          <dl className="hairline-list mt-4">
            <DetailRow
              label={tr.dashboard.bondDetails.infoCards.financial.nextCouponRate}
              value={publishedCouponRate}
              numeric={publishedCouponRate.startsWith("%")}
            />
            {result && (
              <>
                <DetailRow
                  label={tr.dashboard.bondDetails.calculatedMetrics.periodicCouponRate}
                  value={formatPercentFromDecimal(result.periodic_coupon_rate, 4)}
                  numeric
                />
                <DetailRow
                  label={tr.dashboard.bondDetails.calculatedMetrics.annualSimpleInterest}
                  value={formatPercentFromDecimal(result.annual_simple_coupon_rate, 4)}
                  numeric
                />
                <DetailRow
                  label={tr.dashboard.bondDetails.calculatedMetrics.annualCompoundInterest}
                  value={formatPercentFromDecimal(result.annual_compound_coupon_rate, 4)}
                  numeric
                />
              </>
            )}
            <DetailRow label="Kullanılan referans" value={requiredBenchmark || (requiresCpi ? "TÜFE" : "Sabit oran")} />
            {requiredBenchmark && (
              <DetailRow
                label={`${requiredBenchmark} yıllık`}
                value={
                  benchmarks[requiredBenchmark] == null
                    ? "—"
                    : `%${displayNumber(benchmarks[requiredBenchmark], 4)}`
                }
                numeric
              />
            )}
            <DetailRow label="Çözümleme" value={instrument.quality.parse_status} />
            <DetailRow label="Formül" value={String(fields.formula_code || "BAP DCF")} />
          </dl>
          {instrument.remarks_raw && (
            <div className="mt-4 rounded-xl bg-muted/55 p-3">
              <p className="eyebrow">Kaynak Kupon Açıklaması</p>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                {instrument.remarks_raw}
              </p>
            </div>
          )}
          {instrument.instrument_family === "PARTICIPATION" && (
            <p className="mt-3 rounded-xl bg-muted/55 p-3 text-[11px] leading-5 text-muted-foreground">
              TRD ile başlayan katılım kıymetlerinde yalnız TLREFK referansı kullanılır.
            </p>
          )}
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="data-surface rounded-[28px] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Database className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="eyebrow">{tr.dashboard.bondDetails.infoCards.remarks.title}</p>
              <h2 className="mt-1 text-base font-semibold">BIST Kaynak Metni</h2>
            </div>
          </div>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-foreground/80">
            {instrument.remarks_raw || "Bu kıymet için ek açıklama bulunmuyor."}
          </p>
        </article>

        <article className="data-surface rounded-[28px] p-5 sm:p-6">
          <div>
            <p className="eyebrow">Kişisel çalışma alanı</p>
            <h2 className="mt-1 text-base font-semibold">{tr.dashboard.bondDetails.notes.title}</h2>
          </div>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-label="Kıymet notu"
            placeholder={tr.dashboard.bondDetails.notes.placeholder}
            className="mt-5 min-h-32 resize-none rounded-2xl bg-muted/45"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void saveNote()}
              disabled={savingNote || !note.trim()}
              className="rounded-xl"
            >
              <Save className="h-4 w-4" />
              {savingNote
                ? tr.dashboard.bondDetails.notes.saving
                : tr.dashboard.bondDetails.notes.save}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void deleteNote()}
              disabled={savingNote || !note}
              className="rounded-xl text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" />
              {tr.dashboard.bondDetails.notes.delete}
            </Button>
          </div>
        </article>
      </section>

      <section className="space-y-3">
        <details className="data-surface group rounded-2xl">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold">
            <span className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-muted-foreground" />
              Parser ayrıntıları
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border/60 p-4">
            <pre className="max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-300">
              {JSON.stringify(instrument.term_rule_ast, null, 2)}
            </pre>
          </div>
        </details>

        {result && (
          <details className="data-surface group rounded-2xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Teknik izlenebilirlik
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/60 p-4">
              <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-300">
                {JSON.stringify(result.provenance, null, 2)}
              </pre>
            </div>
          </details>
        )}
      </section>
    </main>
  );
}
