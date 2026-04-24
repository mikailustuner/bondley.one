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
import { tr } from "@/locales/tr";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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
  const [historyData, setHistoryData] = useState<Array<{ date: string; clean_price: number | null; ytm: number | null }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (bond) setIsFavorite(!!bond.is_favorite);
  }, [bond]);

  useEffect(() => {
    if (!isin) {
      setError(tr.dashboard.bondDetails.errors.noIsin);
      setLoading(false);
      return;
    }
    const token = getToken();
    if (!token) {
      setError(tr.dashboard.bondDetails.errors.loginRequired);
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
      .catch((e) => setError(e?.message || tr.dashboard.bondDetails.errors.notFound))
      .finally(() => {
        setLoading(false);
        setMetricsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isin, selectedDate]);

  useEffect(() => {
    document.title = `${isin} — ${tr.common.brand}`;
    return () => {
      document.title = tr.common.brand;
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
    const token = getToken();
    if (!token) return;
    setHistoryLoading(true);
    api.bonds
      .history(token, isin, 90)
      .then((r) => setHistoryData(r.items))
      .catch(() => setHistoryData([]))
      .finally(() => setHistoryLoading(false));
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
        title={tr.dashboard.bondDetails.errors.noIsin}
        icon={<AlertCircle className="h-7 w-7" />}
        action={{ label: tr.dashboard.bondDetails.actions.backToList, href: "/dashboard/bonds" }}
      />
    );
  if (loading)
    return <div className="py-12 text-center text-muted-foreground text-[15px]">{tr.dashboard.bondDetails.loading}</div>;
  if (error)
    return (
      <EmptyState
        variant="error"
        title={error === tr.dashboard.bondDetails.errors.loginRequired ? tr.dashboard.bondDetails.errors.loginRequiredTitle : tr.dashboard.bondDetails.errors.errorTitle}
        description={error}
        icon={<AlertCircle className="h-7 w-7" />}
        action={
          error === tr.dashboard.bondDetails.errors.loginRequired
            ? { label: tr.dashboard.bondDetails.errors.login, href: "/login" }
            : { label: tr.dashboard.bondDetails.errors.backToList, href: "/dashboard/bonds" }
        }
      />
    );
  if (!bond)
    return (
      <EmptyState
        title={tr.dashboard.bondDetails.errors.notFound}
        description={tr.dashboard.bondDetails.errors.notFoundDesc}
        icon={<FileQuestion className="h-7 w-7" />}
        action={{ label: tr.dashboard.bondDetails.errors.backToList, href: "/dashboard/bonds" }}
      />
    );

  const daysToNextCoupon = (() => {
    if (!bond.next_coupon_date) return null;
    const ncd = new Date(bond.next_coupon_date);
    const ref = new Date(selectedDate);
    if (Number.isNaN(ncd.getTime()) || Number.isNaN(ref.getTime())) return null;
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    return Math.round(
      (Date.UTC(ncd.getFullYear(), ncd.getMonth(), ncd.getDate()) -
        Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate())) /
      MS_PER_DAY
    );
  })();

  const topMetrics = [
    {
      label: tr.dashboard.bondDetails.topMetrics.lastPrice,
      value: formatDecimal(bond.last_issue_price, 3),
      highlight: true,
    },
    {
      label: tr.dashboard.bondDetails.topMetrics.lastYield,
      value: bond.last_issue_yield != null ? formatPercent(bond.last_issue_yield) : "—",
    },
    {
      label: tr.dashboard.bondDetails.topMetrics.maturity,
      value: bond.days_to_maturity != null ? tr.dashboard.bondDetails.topMetrics.days.replace("{count}", bond.days_to_maturity.toString()) : "—",
    },
    {
      label: tr.dashboard.bondDetails.topMetrics.nextCoupon,
      value:
        daysToNextCoupon != null
          ? daysToNextCoupon > 0
            ? tr.dashboard.bondDetails.topMetrics.days.replace("{count}", daysToNextCoupon.toString())
            : daysToNextCoupon === 0
              ? tr.dashboard.bondDetails.topMetrics.today
              : tr.dashboard.bondDetails.topMetrics.past
          : "—",
    },
  ];

  const generalInfo = [
    [tr.dashboard.bondDetails.infoCards.general.isin, bond.isin_code],
    [tr.dashboard.bondDetails.infoCards.general.issuer, bond.issuer],
    ...(bond.fund_user ? [[tr.dashboard.bondDetails.infoCards.general.fundUser, bond.fund_user]] : []),
    ...(bond.source_institution ? [[tr.dashboard.bondDetails.infoCards.general.sourceInst, bond.source_institution]] : []),
    [tr.dashboard.bondDetails.infoCards.general.issuanceType, bond.issuance_type],
    [tr.dashboard.bondDetails.infoCards.general.yieldType, bond.yield_type],
    [tr.dashboard.bondDetails.infoCards.general.securityType, bond.security_type],
    [tr.dashboard.bondDetails.infoCards.general.couponFreq, bond.coupon_frequency],
    [tr.dashboard.bondDetails.infoCards.general.currency, bond.currency],
    [tr.dashboard.bondDetails.infoCards.general.groupCode, bond.group_code],
    [tr.dashboard.bondDetails.infoCards.general.detailType, bond.security_type_detail],
    [tr.dashboard.bondDetails.infoCards.general.dayCount, bond.day_count_convention],
    [tr.dashboard.bondDetails.infoCards.general.quotation, bond.quotation_method],
  ];

  const dateInfo = [
    [tr.dashboard.bondDetails.infoCards.dates.firstIssue, formatDate(bond.first_issue_date)],
    [tr.dashboard.bondDetails.infoCards.dates.maturity, formatDate(bond.maturity_date)],
    [tr.dashboard.bondDetails.infoCards.dates.lastIssue, formatLastIssueDateText(bond.last_issue_date_text)],
    [tr.dashboard.bondDetails.infoCards.dates.nextCoupon, formatDate(bond.next_coupon_date)],
    [
      tr.dashboard.bondDetails.infoCards.dates.daysToCoupon,
      daysToNextCoupon != null
        ? daysToNextCoupon > 0
          ? `${daysToNextCoupon}`
          : daysToNextCoupon === 0
            ? tr.dashboard.bondDetails.topMetrics.today
            : tr.dashboard.bondDetails.topMetrics.past
        : "—",
    ],
    [tr.dashboard.bondDetails.infoCards.dates.daysToMaturity, bond.days_to_maturity != null ? `${bond.days_to_maturity}` : "—"],
  ];

  const financialInfo = [
    [tr.dashboard.bondDetails.infoCards.financial.firstPrice, formatDecimal(bond.first_issue_price, 3)],
    [tr.dashboard.bondDetails.infoCards.financial.lastPrice, formatDecimal(bond.last_issue_price, 3)],
    [tr.dashboard.bondDetails.infoCards.financial.firstYield, bond.first_issue_yield != null ? formatPercent(bond.first_issue_yield) : "—"],
    [tr.dashboard.bondDetails.infoCards.financial.lastYield, bond.last_issue_yield != null ? formatPercent(bond.last_issue_yield) : "—"],
    [tr.dashboard.bondDetails.infoCards.financial.nextCouponRate, bond.next_coupon_rate != null ? formatPercent(bond.next_coupon_rate) : "—"],
    [tr.dashboard.bondDetails.infoCards.financial.spread, bond.spread != null ? formatPercent(bond.spread) : "—"],
    ["Sözleşmesel Ek Getiri (Dinamik)", bond.calculated_metrics?.contractual_spread != null ? formatPercentFromDecimal(bond.calculated_metrics.contractual_spread, 4) : "—"],
    [tr.dashboard.bondDetails.infoCards.financial.calculatedSpread, bond.calculated_metrics?.spread != null ? formatPercentFromDecimal(bond.calculated_metrics.spread, 4) : "—"],
    [
      tr.dashboard.bondDetails.infoCards.financial.lastTlref,
      tlrefLatest?.daily_rate != null ? formatPercentFromDecimal(tlrefLatest.daily_rate * 365, 4) : "—",
    ],
    [
      tr.dashboard.bondDetails.infoCards.financial.lastTlrefk,
      tlrefLatest?.index_value != null ? formatDecimal(tlrefLatest.index_value, 5, 5) : "—",
    ],
    [
      tr.dashboard.bondDetails.infoCards.financial.calcTlrefDate,
      bond.calculated_metrics?.tlref_rate_date ? formatDate(bond.calculated_metrics.tlref_rate_date) : "—",
    ],
    [
      tr.dashboard.bondDetails.infoCards.financial.totalIssue,
      bond.total_issue_amount != null
        ? tr.dashboard.bondDetails.infoCards.financial.issueAmountText.replace("{amount}", formatDecimal(bond.total_issue_amount, 0)).replace("{currency}", bond.currency)
        : "—",
    ],
  ];

  const formulaInfo = [
    [tr.dashboard.bondDetails.infoCards.methods.accrued, bond.accrued_interest_text],
    [tr.dashboard.bondDetails.infoCards.methods.cleanPrice, bond.clean_price_text],
    [tr.dashboard.bondDetails.infoCards.methods.dirtyPrice, bond.dirty_price_formula],
    [tr.dashboard.bondDetails.infoCards.methods.settlementPrice, bond.settlement_price_formula],
    [tr.dashboard.bondDetails.infoCards.methods.yield, bond.yield_formula],
    [tr.dashboard.bondDetails.infoCards.methods.compoundYield, bond.compound_yield_formula],
  ];

  return (
    <div className="space-y-6">
      {/* ═══ Hero Header ═══ */}
      <div className="animate-fade-up">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-2 text-[13px]">
            <li>
              <Link href="/dashboard/bonds" className="text-muted-foreground hover:text-primary transition-colors">
                {tr.dashboard.bondDetails.breadcrumb}
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
              {!bond.is_active && <Badge variant="destructive">{tr.dashboard.bondDetails.hero.passive}</Badge>}
            </div>
            {bond.fund_user ? (
              <p className="text-[15px] text-muted-foreground mt-1">
                {tr.dashboard.bondDetails.hero.issuerVksh}: <span className="font-medium text-foreground">{bond.issuer || tr.dashboard.bondDetails.hero.unknown}</span> · {tr.dashboard.bondDetails.hero.fundUser}: <span className="font-medium text-foreground">{bond.fund_user}</span>
              </p>
            ) : (
              <p className="text-[15px] text-muted-foreground mt-1">
                {bond.issuer || tr.dashboard.bondDetails.hero.unknown} · {bond.security_type ? bond.security_type.split("/")[0].trim() : "—"}
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
              aria-label={isFavorite ? tr.dashboard.bondDetails.actions.removeFavorite : tr.dashboard.bondDetails.actions.addFavorite}
            >
              <Star className={`h-4 w-4 ${isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
              {isFavorite ? tr.dashboard.bondDetails.actions.favorite : tr.dashboard.bondDetails.actions.addFavorite}
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
          <span className="text-[13px] font-medium text-muted-foreground">{tr.dashboard.bondDetails.dateSelector.label}</span>
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
              { label: tr.dashboard.bondDetails.dateSelector.today, fn: todayISO },
              { label: tr.dashboard.bondDetails.dateSelector.lastBusinessDay, fn: lastBusinessDayISO },
              { label: tr.dashboard.bondDetails.dateSelector.week, fn: weekAgoISO },
              { label: tr.dashboard.bondDetails.dateSelector.month, fn: monthAgoISO },
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
            {tr.dashboard.bondDetails.dateSelector.noData}
          </div>
        )}
        {metricsLoading && (
          <span className="text-[13px] text-muted-foreground mt-3 block">{tr.dashboard.bondDetails.dateSelector.calculating}</span>
        )}
      </div>

      {/* ═══ Calculated Metrics ═══ */}
      {bond.calculated_metrics && !metricsLoading && (
        <Card className="animate-fade-up border-primary/20 bg-primary/[0.02]">
          <CardHeader>
            <CardDescription>{tr.dashboard.bondDetails.calculatedMetrics.title}</CardDescription>
            <CardTitle className="mt-1 flex items-center gap-2">
              {tr.dashboard.bondDetails.calculatedMetrics.subtitle.replace("{date}", formatDate(selectedDate))}
              {bond.calculated_metrics.is_theoretical && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20 font-normal">
                  {tr.dashboard.bondDetails.calculatedMetrics.theoreticalBadge}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: tr.dashboard.bondDetails.calculatedMetrics.dirtyPrice, value: formatDecimal(bond.calculated_metrics.dirty_price, 8, 8), primary: true },
                { label: tr.dashboard.bondDetails.calculatedMetrics.accruedInterest, value: formatDecimal(bond.calculated_metrics.accrued_interest, 8, 8) },
                { label: "Sözleşmesel Ek Getiri", value: bond.calculated_metrics.contractual_spread != null ? formatPercentFromDecimal(bond.calculated_metrics.contractual_spread, 4) : "—" },
                { label: "Ek Getiri Kaynağı (Remarks)", value: bond.calculated_metrics.remarks ? (bond.calculated_metrics.remarks.length > 30 ? bond.calculated_metrics.remarks.substring(0, 30) + "..." : bond.calculated_metrics.remarks) : "—" },
                { label: tr.dashboard.bondDetails.calculatedMetrics.rateChange, value: bond.calculated_metrics.rate_change_today_pct != null ? formatPercent(bond.calculated_metrics.rate_change_today_pct) : "—" },
                { label: tr.dashboard.bondDetails.calculatedMetrics.cleanPrice, value: formatDecimal(bond.calculated_metrics.clean_price_used, 8, 8) },
                ...(bond.calculated_metrics.annual_reference_rate != null ? [{ label: tr.dashboard.bondDetails.calculatedMetrics.annualRefRate, value: formatPercentFromDecimal(bond.calculated_metrics.annual_reference_rate, 4) }] : []),
                ...(bond.calculated_metrics.annual_coupon_rate != null ? [{ label: tr.dashboard.bondDetails.calculatedMetrics.annualCouponRate, value: formatPercentFromDecimal(bond.calculated_metrics.annual_coupon_rate, 4) }] : []),
                ...(bond.calculated_metrics.annual_compound_coupon_rate != null ? [{ label: tr.dashboard.bondDetails.calculatedMetrics.annualCompoundCouponRate, value: formatPercentFromDecimal(bond.calculated_metrics.annual_compound_coupon_rate, 4) }] : []),
                ...(bond.calculated_metrics.periodic_coupon_rate != null ? [{ label: tr.dashboard.bondDetails.calculatedMetrics.periodicCouponRate, value: formatPercentFromDecimal(bond.calculated_metrics.periodic_coupon_rate, 4) }] : []),
                ...(bond.calculated_metrics.yield_to_maturity != null ? [{ label: tr.dashboard.bondDetails.calculatedMetrics.ytm, value: formatPercentFromDecimal(bond.calculated_metrics.yield_to_maturity, 4) }] : []),
                ...(bond.calculated_metrics.return_to_date_pct != null ? [{ label: tr.dashboard.bondDetails.calculatedMetrics.returnToDate, value: formatPercent(bond.calculated_metrics.return_to_date_pct) }] : []),
                ...(bond.calculated_metrics.modified_duration != null ? [{ label: tr.dashboard.bondDetails.calculatedMetrics.modDuration, value: formatDecimal(bond.calculated_metrics.modified_duration, 4) }] : []),
                ...(bond.calculated_metrics.macaulay_duration != null ? [{ label: tr.dashboard.bondDetails.calculatedMetrics.macDuration, value: formatDecimal(bond.calculated_metrics.macaulay_duration, 4) }] : []),
                ...(bond.calculated_metrics.convexity != null ? [{ label: tr.dashboard.bondDetails.calculatedMetrics.convexity, value: formatDecimal(bond.calculated_metrics.convexity, 4) }] : []),
                ...(bond.calculated_metrics.coupon_payment_amount != null ? [{ label: tr.dashboard.bondDetails.calculatedMetrics.couponAmount, value: formatDecimal(bond.calculated_metrics.coupon_payment_amount, 4) }] : []),
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
                {tr.dashboard.bondDetails.calculatedMetrics.fallbackNotice}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ Scenario ═══ */}
      {bond.calculated_metrics && !metricsLoading && (
        <Card className="animate-fade-up">
          <CardHeader>
            <CardDescription>{tr.dashboard.bondDetails.scenario.title}</CardDescription>
            <CardTitle className="mt-1">{tr.dashboard.bondDetails.scenario.subtitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-[13px] text-muted-foreground block mb-3">
                {tr.dashboard.bondDetails.scenario.shockLabel.replace("{shock}", `${scenarioShockBp > 0 ? "+" : ""}${scenarioShockBp}`)}
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
                <span className="font-medium text-foreground">{tr.dashboard.bondDetails.scenario.preview}</span>{" "}
                {tr.dashboard.bondDetails.scenario.dirtyPriceApprox}{" "}
                <span className="font-mono-data text-foreground">
                  {formatDecimal(
                    baseScenarioMetrics.current_dirty_price *
                    (1 - (baseScenarioMetrics.modified_duration ?? 0) * (scenarioShockBp / 10000)),
                    4, 4
                  )}
                </span>
                , {tr.dashboard.bondDetails.scenario.change}{" "}
                <span className={(baseScenarioMetrics.modified_duration ?? 0) * scenarioShockBp <= 0 ? "text-negative" : "text-positive"}>
                  {formatPercent(-((baseScenarioMetrics.modified_duration ?? 0) * (scenarioShockBp / 10000)) * 100)}
                </span>
                {" · "}{tr.dashboard.bondDetails.scenario.ytmApprox}{" "}
                <span className="font-mono-data text-foreground">
                  {formatPercentFromDecimal(baseScenarioMetrics.current_ytm + scenarioShockBp / 10000, 4)}
                </span>
              </div>
            )}
            {scenarioLoading && (
              <p className="text-[13px] text-muted-foreground">{tr.dashboard.bondDetails.scenario.calculating}</p>
            )}
            {!scenarioLoading && scenarioResult && (
              <div className="rounded-2xl border border-border/50 bg-card p-4">
                <p className="text-[13px] text-foreground">
                  TLREF {scenarioResult.shock_bp > 0 ? "+" : ""}{scenarioResult.shock_bp} bp → {tr.dashboard.bondDetails.scenario.dirtyPriceApprox}: <span className="font-mono-data">{formatDecimal(scenarioResult.new_dirty_price_approx, 4, 4)}</span>, {tr.dashboard.bondDetails.scenario.change}:{" "}
                  <span className={scenarioResult.price_change_pct >= 0 ? "text-positive" : "text-negative"}>
                    {formatPercent(scenarioResult.price_change_pct)}
                  </span>
                </p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {tr.dashboard.bondDetails.scenario.ytmApprox}: {formatPercentFromDecimal(scenarioResult.new_ytm_approx, 4)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ Price / YTM History Chart ═══ */}
      {(historyLoading || historyData.length > 0) && (
        <Card className="animate-fade-up">
          <CardHeader>
            <CardDescription>Son 90 Gün</CardDescription>
            <CardTitle className="mt-1">Fiyat ve YTM Geçmişi</CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="h-64 flex items-center justify-center text-[13px] text-muted-foreground">
                Yükleniyor…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={historyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(5)}
                    interval="preserveStartEnd"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    yAxisId="price"
                    orientation="left"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => v.toFixed(2)}
                    domain={["auto", "auto"]}
                    className="text-muted-foreground"
                    width={60}
                  />
                  <YAxis
                    yAxisId="ytm"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `%${(v * 100).toFixed(1)}`}
                    domain={["auto", "auto"]}
                    className="text-muted-foreground"
                    width={64}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 12 }}
                    formatter={(value: number, name: string) =>
                      name === "YTM"
                        ? [`%${(value * 100).toFixed(4)}`, name]
                        : [value.toFixed(4), name]
                    }
                    labelFormatter={(label: string) => formatDate(label)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="clean_price"
                    name="Temiz Fiyat"
                    stroke="hsl(var(--primary))"
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                  />
                  <Line
                    yAxisId="ytm"
                    type="monotone"
                    dataKey="ytm"
                    name="YTM"
                    stroke="hsl(var(--chart-2, 217 91% 60%))"
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* No metrics fallback */}
      {!bond.calculated_metrics && !metricsLoading && (
        <Card>
          <CardHeader>
            <CardTitle>{tr.dashboard.bondDetails.noMetrics.title}</CardTitle>
            <CardDescription>
              {selectedDate === todayISO() ? tr.dashboard.bondDetails.noMetrics.subtitleToday : tr.dashboard.bondDetails.noMetrics.subtitle.replace("{date}", formatDate(selectedDate))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-5 bg-secondary/30 border border-border/30 rounded-2xl text-center">
              <p className="text-[14px] text-muted-foreground">
                {selectedDate === todayISO()
                  ? tr.dashboard.bondDetails.noMetrics.descriptionToday
                  : tr.dashboard.bondDetails.noMetrics.description.replace("{date}", formatDate(selectedDate))}
              </p>
              <p className="text-[12px] text-muted-foreground mt-2">
                {tr.dashboard.bondDetails.noMetrics.footer}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fallback market data notice */}
      {bond.calculated_metrics?.used_fallback_market_data && bond.calculated_metrics?.market_data_date && (
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-[13px] text-muted-foreground animate-fade-up">
          <span className="font-medium text-amber-600 dark:text-amber-400">{tr.dashboard.bondDetails.fallbackNotice.note}</span>{" "}
          {tr.dashboard.bondDetails.fallbackNotice.description.replace("{date}", formatDate(bond.calculated_metrics.market_data_date))}
        </div>
      )}

      {/* ═══ Info Cards — 2 column grid ═══ */}
      <div className="grid gap-5 lg:grid-cols-2 animate-fade-up-delay-1">
        <Card>
          <CardHeader>
            <CardDescription>{tr.dashboard.bondDetails.infoCards.general.desc}</CardDescription>
            <CardTitle className="mt-1">{tr.dashboard.bondDetails.infoCards.general.title}</CardTitle>
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
            <CardDescription>{tr.dashboard.bondDetails.infoCards.dates.desc}</CardDescription>
            <CardTitle className="mt-1">{tr.dashboard.bondDetails.infoCards.dates.title}</CardTitle>
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
            <CardDescription>{tr.dashboard.bondDetails.infoCards.financial.desc}</CardDescription>
            <CardTitle className="mt-1">{tr.dashboard.bondDetails.infoCards.financial.title}</CardTitle>
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
            <CardDescription>{tr.dashboard.bondDetails.infoCards.methods.desc}</CardDescription>
            <CardTitle className="mt-1">{tr.dashboard.bondDetails.infoCards.methods.title}</CardTitle>
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
            <CardDescription>{tr.dashboard.bondDetails.infoCards.remarks.desc}</CardDescription>
            <CardTitle className="mt-1">{tr.dashboard.bondDetails.infoCards.remarks.title}</CardTitle>
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
            <CardDescription>{tr.dashboard.bondDetails.infoCards.conflicts.desc}</CardDescription>
            <CardTitle className="mt-1">{tr.dashboard.bondDetails.infoCards.conflicts.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2.5 text-muted-foreground font-medium">{tr.dashboard.bondDetails.infoCards.conflicts.cols.field}</th>
                    <th className="text-left py-2.5 text-muted-foreground font-medium">{tr.dashboard.bondDetails.infoCards.conflicts.cols.tbliste}</th>
                    <th className="text-left py-2.5 text-muted-foreground font-medium">{tr.dashboard.bondDetails.infoCards.conflicts.cols.kap}</th>
                    <th className="text-left py-2.5 text-muted-foreground font-medium">{tr.dashboard.bondDetails.infoCards.conflicts.cols.used}</th>
                  </tr>
                </thead>
                <tbody>
                  {bond.data_conflicts.map((c: any, idx: number) => (
                    <tr key={idx} className="border-b border-border/20">
                      <td className="py-2.5 text-foreground font-medium">{c.field}</td>
                      <td className={`py-2.5 font-mono-data ${c.resolved_source === 'tbliste' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{c.tbliste_value}</td>
                      <td className={`py-2.5 font-mono-data ${c.resolved_source === 'kap' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{c.kap_value}</td>
                      <td className="py-2.5">
                        <Badge variant={c.resolved_source === 'kap' ? 'default' : 'secondary'}>{c.resolved_source === 'kap' ? tr.dashboard.bondDetails.infoCards.conflicts.kapBadge : tr.dashboard.bondDetails.infoCards.conflicts.tblisteBadge}</Badge>
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
            <CardDescription>{tr.dashboard.bondDetails.kap.desc}</CardDescription>
            <CardTitle className="mt-1">
              {tr.dashboard.bondDetails.kap.title}
              {bond.kap_data.disclosure_url && (
                <a href={bond.kap_data.disclosure_url} target="_blank" rel="noopener noreferrer" className="ml-3 text-[13px] font-normal text-primary hover:underline">
                  {tr.dashboard.bondDetails.kap.disclosure}
                </a>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-0">
                <h4 className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">{tr.dashboard.bondDetails.kap.instrument.title}</h4>
                {[
                  [tr.dashboard.bondDetails.kap.instrument.isin, bond.kap_data.isin_code],
                  [tr.dashboard.bondDetails.kap.instrument.type, bond.kap_data.instrument_type],
                  ...(bond.kap_data.fund_user ? [[tr.dashboard.bondDetails.kap.instrument.fundUser, bond.kap_data.fund_user]] : []),
                  ...(bond.kap_data.source_institution ? [[tr.dashboard.bondDetails.kap.instrument.sourceInst, bond.kap_data.source_institution]] : []),
                  [tr.dashboard.bondDetails.kap.instrument.maturity, bond.kap_data.maturity_date ? formatDate(bond.kap_data.maturity_date) : null],
                  [tr.dashboard.bondDetails.kap.instrument.days, bond.kap_data.maturity_days],
                  [tr.dashboard.bondDetails.kap.instrument.nominal, bond.kap_data.nominal_value ? `${Number(bond.kap_data.nominal_value).toLocaleString('tr-TR')} ${bond.kap_data.currency || 'TRY'}` : null],
                  [tr.dashboard.bondDetails.kap.instrument.price, bond.kap_data.issue_price],
                  [tr.dashboard.bondDetails.kap.instrument.interestType, bond.kap_data.interest_rate_type],
                  [tr.dashboard.bondDetails.kap.instrument.floatingRef, bond.kap_data.floating_rate_reference],
                  [tr.dashboard.bondDetails.kap.instrument.additionalReturn, bond.kap_data.additional_return_pct],
                  [tr.dashboard.bondDetails.kap.instrument.coupons, bond.kap_data.coupon_number],
                  [tr.dashboard.bondDetails.kap.instrument.frequency, bond.kap_data.coupon_frequency],
                  [tr.dashboard.bondDetails.kap.instrument.paymentType, bond.kap_data.payment_type],
                ].map(([label, value]) => (
                  <InfoRow key={label as string} label={label as string} value={value as string} />
                ))}
              </div>
              <div className="space-y-0">
                <h4 className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">{tr.dashboard.bondDetails.kap.sale.title}</h4>
                {[
                  [tr.dashboard.bondDetails.kap.sale.type, bond.kap_data.sale_type],
                  [tr.dashboard.bondDetails.kap.sale.start, bond.kap_data.starting_date_sale ? formatDate(bond.kap_data.starting_date_sale) : null],
                  [tr.dashboard.bondDetails.kap.sale.end, bond.kap_data.ending_date_sale ? formatDate(bond.kap_data.ending_date_sale) : null],
                  [tr.dashboard.bondDetails.kap.sale.traded, bond.kap_data.traded_in_exchange === true ? tr.dashboard.bondDetails.kap.sale.yes : bond.kap_data.traded_in_exchange === false ? tr.dashboard.bondDetails.kap.sale.no : null],
                  [tr.dashboard.bondDetails.kap.sale.broker, bond.kap_data.intermediary_brokerage],
                  [tr.dashboard.bondDetails.kap.sale.limit, bond.kap_data.issue_limit ? `${Number(bond.kap_data.issue_limit).toLocaleString('tr-TR')} TRY` : null],
                  [tr.dashboard.bondDetails.kap.sale.ratingCompany, bond.kap_data.issuer_rating_company],
                  [tr.dashboard.bondDetails.kap.sale.ratingNote, bond.kap_data.issuer_rating_note],
                  [tr.dashboard.bondDetails.kap.sale.ratingDate, bond.kap_data.issuer_rating_date ? formatDate(bond.kap_data.issuer_rating_date) : null],
                  [tr.dashboard.bondDetails.kap.sale.investmentGrade, bond.kap_data.issuer_rating_investment_grade === true ? tr.dashboard.bondDetails.kap.sale.yes : bond.kap_data.issuer_rating_investment_grade === false ? tr.dashboard.bondDetails.kap.sale.no : null],
                ].map(([label, value]) => (
                  <InfoRow key={label as string} label={label as string} value={value as string} />
                ))}
              </div>
            </div>

            {/* Coupon Payments */}
            {bond.kap_data.coupon_payments && bond.kap_data.coupon_payments.length > 0 && (
              <div>
                <h4 className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">{tr.dashboard.bondDetails.kap.plan.title}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2.5 text-muted-foreground font-medium">{tr.dashboard.bondDetails.kap.plan.cols.coupon}</th>
                        <th className="text-left py-2.5 text-muted-foreground font-medium">{tr.dashboard.bondDetails.kap.plan.cols.date}</th>
                        <th className="text-right py-2.5 text-muted-foreground font-medium">{tr.dashboard.bondDetails.kap.plan.cols.periodic}</th>
                        <th className="text-right py-2.5 text-muted-foreground font-medium">{tr.dashboard.bondDetails.kap.plan.cols.simple}</th>
                        <th className="text-right py-2.5 text-muted-foreground font-medium">{tr.dashboard.bondDetails.kap.plan.cols.compound}</th>
                        <th className="text-right py-2.5 text-muted-foreground font-medium">{tr.dashboard.bondDetails.kap.plan.cols.amount}</th>
                        <th className="text-center py-2.5 text-muted-foreground font-medium">{tr.dashboard.bondDetails.kap.plan.cols.paid}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bond.kap_data.coupon_payments.map((cp: any, idx: number) => (
                        <tr key={idx} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                          <td className="py-2.5 font-mono-data text-foreground font-medium">
                            {cp.coupon_number === "principal" ? tr.dashboard.bondDetails.kap.plan.principal : `#${cp.coupon_number}`}
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
