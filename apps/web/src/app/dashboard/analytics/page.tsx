"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TlrefIndexChart } from "@/components/charts/tlref-index-chart";
import { TlrefRateChart } from "@/components/charts/tlref-rate-chart";
import { useTlrefHistory } from "@/hooks/use-tlref-history";
import { formatDecimal, formatPercent } from "@/lib/utils";
import { tr } from "@/locales/tr";
import { api, YieldCurvePoint } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function AnalyticsPage() {
  useEffect(() => {
    document.title = `${tr.dashboard.analytics.title} — ${tr.common.brand}`;
    return () => {
      document.title = tr.common.brand;
    };
  }, []);
  const { history, indexData, rateData, bondStats, loading } = useTlrefHistory();
  const [yieldCurvePoints, setYieldCurvePoints] = useState<YieldCurvePoint[]>([]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.bonds.yieldCurve(token).then((res) => setYieldCurvePoints(res.items)).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-[15px]">
        {tr.dashboard.analytics.loading}
      </div>
    );
  }

  const last30 = history.slice(-30);
  const dailyRates = last30.filter((r) => r.daily_rate != null && r.daily_rate > 0);
  const avgDailyRatePct =
    dailyRates.length > 0
      ? (dailyRates.reduce((acc, r) => acc + (r.daily_rate ?? 0), 0) / dailyRates.length) * 100
      : null;

  const validHistory = history.filter((r) => r.index_value > 0);
  const minIndex = validHistory.length ? Math.min(...validHistory.map((r) => r.index_value)) : null;
  const maxIndex = validHistory.length ? Math.max(...validHistory.map((r) => r.index_value)) : null;
  const totalReturnPct =
    validHistory.length >= 2 && validHistory[0].index_value > 0
      ? ((validHistory[validHistory.length - 1].index_value - validHistory[0].index_value) /
          validHistory[0].index_value) *
        100
      : null;
  const safeTotal = totalReturnPct != null && isFinite(totalReturnPct) ? totalReturnPct : null;

  const sortedSecTypes = bondStats
    ? Object.entries(bondStats.by_security_type).sort(([, a], [, b]) => b - a)
    : [];
  const sortedYieldTypes = bondStats
    ? Object.entries(bondStats.by_yield_type).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-display-md text-foreground">{tr.dashboard.analytics.title}</h1>
        <p className="text-[15px] text-muted-foreground mt-1.5">
          {tr.dashboard.analytics.desc}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 animate-fade-up">
        {[
          { label: tr.dashboard.analytics.stats.totalReturn, value: safeTotal != null ? formatPercent(safeTotal) : "—", sub: tr.dashboard.analytics.stats.cumulative, highlight: true },
          { label: tr.dashboard.analytics.stats.avgDaily, value: avgDailyRatePct != null ? formatPercent(avgDailyRatePct) : "—", sub: tr.dashboard.analytics.stats.last30 },
          { label: tr.dashboard.analytics.stats.min, value: minIndex != null ? formatDecimal(minIndex, 2) : "—", sub: tr.dashboard.analytics.stats.index },
          { label: tr.dashboard.analytics.stats.max, value: maxIndex != null ? formatDecimal(maxIndex, 2) : "—", sub: tr.dashboard.analytics.stats.index },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-3xl border border-border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[13px] font-medium text-muted-foreground mb-2">{stat.label}</div>
            <div className={`font-mono-data text-stat ${stat.highlight ? "text-positive" : "text-foreground"}`}>
              {stat.value}
            </div>
            <div className="text-[13px] text-muted-foreground mt-1.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>{tr.dashboard.analytics.charts.tlrefIndex}</CardDescription>
              <CardTitle className="mt-1">{tr.dashboard.analytics.charts.tlrefIndexTitle}</CardTitle>
            </div>
            <Badge variant="outline">{tr.dashboard.analytics.charts.days.replace("{count}", history.length.toString())}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <TlrefIndexChart data={indexData} />
        </CardContent>
      </Card>

      <Card className="animate-fade-up-delay-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>{tr.dashboard.analytics.charts.tlrefRate}</CardDescription>
              <CardTitle className="mt-1">{tr.dashboard.analytics.charts.tlrefRateTitle}</CardTitle>
            </div>
            <Badge variant="outline">{tr.dashboard.analytics.charts.last90}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <TlrefRateChart data={rateData} />
        </CardContent>
      </Card>

      {/* Yield Curve */}
      {yieldCurvePoints.length > 0 && (() => {
        const classify = (p: YieldCurvePoint): "floating" | "fixed" | "other" => {
          const yt = p.yield_type?.toLowerCase() ?? "";
          if (yt.includes("değişken") || yt.includes("floating")) return "floating";
          if (yt.includes("sabit") || yt.includes("fixed")) return "fixed";
          return "other";
        };

        const DOT_COLOR: Record<string, string> = {
          floating: "hsl(211, 100%, 50%)",
          fixed:    "hsl(142, 71%, 45%)",
          other:    "hsl(var(--muted-foreground))",
        };

        const allSorted = [...yieldCurvePoints].sort((a, b) => a.days_to_maturity - b.days_to_maturity);

        const xFmt = (v: number) => {
          if (v >= 365) return `${Math.round(v / 365)}y`;
          if (v >= 30)  return `${Math.round(v / 30)}ay`;
          return `${v}g`;
        };

        const maxDays = allSorted[allSorted.length - 1]?.days_to_maturity ?? 0;
        const xTicks = [90, 182, 365, 548, 730, 1095, 1460, 1825].filter((t) => t <= maxDays + 90);

        /* Custom dot — colors each circle by yield_type */
        const YieldDot = (props: { cx?: number; cy?: number; payload?: YieldCurvePoint }) => {
          const { cx, cy, payload } = props;
          if (!cx || !cy || !payload) return null;
          return (
            <circle
              cx={cx}
              cy={cy}
              r={3.5}
              fill={DOT_COLOR[classify(payload)]}
              opacity={0.75}
            />
          );
        };

        /* Tooltip */
        const YieldTooltip = ({ active, payload }: any) => {
          if (!active || !payload?.length) return null;
          const d = payload[0]?.payload as YieldCurvePoint;
          if (!d?.isin_code) return null;
          const color = DOT_COLOR[classify(d)];
          return (
            <div className="bg-card border border-border rounded-2xl px-3.5 py-3 text-[12px] shadow-lg space-y-1.5 min-w-[180px]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="font-semibold text-foreground text-[13px]">{d.isin_code}</span>
              </div>
              {d.issuer && (
                <div className="text-muted-foreground truncate max-w-[210px]">{d.issuer.split("/")[0].trim()}</div>
              )}
              <div className="border-t border-border/40 pt-1.5 space-y-1">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">YTM</span>
                  <span className="font-mono-data font-semibold text-foreground">{d.ytm_pct.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Vade</span>
                  <span className="font-mono-data text-foreground">{xFmt(d.days_to_maturity)}</span>
                </div>
                {d.yield_type && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Tür</span>
                    <span className="text-foreground">{d.yield_type.split("/")[0].trim()}</span>
                  </div>
                )}
              </div>
            </div>
          );
        };

        const floatingCount = allSorted.filter((p) => classify(p) === "floating").length;
        const fixedCount    = allSorted.filter((p) => classify(p) === "fixed").length;
        const otherCount    = allSorted.filter((p) => classify(p) === "other").length;

        return (
          <Card className="animate-fade-up-delay-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription>{tr.dashboard.analytics.yieldCurve.desc}</CardDescription>
                  <CardTitle className="mt-1">{tr.dashboard.analytics.yieldCurve.title}</CardTitle>
                </div>
                <Badge variant="outline">{yieldCurvePoints.length} Araç</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={allSorted} margin={{ top: 8, right: 16, bottom: 32, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                  <XAxis
                    dataKey="days_to_maturity"
                    type="number"
                    scale="linear"
                    domain={[0, "auto"]}
                    ticks={xTicks}
                    tickFormatter={xFmt}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: tr.dashboard.analytics.yieldCurve.xLabel, position: "insideBottom", offset: -18, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    dataKey="ytm_pct"
                    type="number"
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip content={<YieldTooltip />} cursor={{ strokeDasharray: "4 4", stroke: "hsl(var(--border))" }} />

                  <Line
                    dataKey="ytm_pct"
                    type="monotone"
                    stroke="hsl(var(--border))"
                    strokeWidth={1.5}
                    dot={<YieldDot />}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    isAnimationActive={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Manual legend */}
              <div className="flex items-center justify-center gap-6 mt-3">
                {floatingCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: DOT_COLOR.floating }} />
                    <span className="text-[12px] text-muted-foreground">{tr.dashboard.analytics.yieldCurve.legend.floating} ({floatingCount})</span>
                  </div>
                )}
                {fixedCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: DOT_COLOR.fixed }} />
                    <span className="text-[12px] text-muted-foreground">{tr.dashboard.analytics.yieldCurve.legend.fixed} ({fixedCount})</span>
                  </div>
                )}
                {otherCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--muted-foreground))" }} />
                    <span className="text-[12px] text-muted-foreground">{tr.dashboard.analytics.yieldCurve.legend.other} ({otherCount})</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Distribution Analysis */}
      {bondStats && bondStats.total_bonds > 0 && (
        <>
          <div className="animate-fade-up-delay-2">
            <h2 className="text-display-sm text-foreground mb-6">
              {tr.dashboard.analytics.distribution.title}
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 animate-fade-up-delay-2">
            <Card>
              <CardHeader>
                <CardDescription>{tr.dashboard.analytics.distribution.bySecurityType}</CardDescription>
                <CardTitle className="mt-1">{tr.dashboard.analytics.distribution.securityTypeDist}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {sortedSecTypes.map(([type, count]) => {
                    const pct =
                      bondStats.total_bonds > 0
                        ? formatDecimal((count / bondStats.total_bonds) * 100, 1)
                        : "0";
                    const shortName = type.split("/")[0].trim();
                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between py-3.5 border-b border-border/30 last:border-0"
                      >
                        <span className="text-[13px] text-muted-foreground max-w-[60%] truncate">
                          {shortName}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min((count / bondStats.total_bonds) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono-data text-[13px] text-foreground w-16 text-right">
                            {count} ({pct}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>{tr.dashboard.analytics.distribution.byYieldType}</CardDescription>
                <CardTitle className="mt-1">{tr.dashboard.analytics.distribution.yieldTypeDist}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {sortedYieldTypes.map(([type, count]) => {
                    const pct =
                      bondStats.total_bonds > 0
                        ? formatDecimal((count / bondStats.total_bonds) * 100, 1)
                        : "0";
                    const shortName = type.split("/")[0].trim();
                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between py-3.5 border-b border-border/30 last:border-0"
                      >
                        <span className="text-[13px] text-muted-foreground max-w-[60%] truncate">
                          {shortName}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min((count / bondStats.total_bonds) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono-data text-[13px] text-foreground w-16 text-right">
                            {count} ({pct}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="animate-fade-up-delay-2">
            <CardHeader>
              <CardDescription>{tr.dashboard.analytics.distribution.byCurrency}</CardDescription>
              <CardTitle className="mt-1">{tr.dashboard.analytics.distribution.currencyDist}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                {Object.entries(bondStats.by_currency)
                  .sort(([, a], [, b]) => b - a)
                  .map(([currency, count]) => (
                    <div key={currency} className="bg-secondary/30 rounded-xl p-4">
                      <div className="text-[13px] text-muted-foreground mb-1.5">{currency}</div>
                      <div className="font-mono-data text-xl text-foreground">
                        {formatDecimal(count, 0)}
                      </div>
                      <div className="text-[13px] text-muted-foreground mt-1">
                        {bondStats.total_bonds > 0
                          ? formatPercent((count / bondStats.total_bonds) * 100)
                          : "—"}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
