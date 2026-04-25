"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { tr } from "@/locales/tr";

const PRIMARY = "hsl(211, 100%, 50%)";
const GRID    = "hsl(var(--border))";
const MUTED   = "hsl(var(--muted-foreground))";

interface Props {
  data: { date: string; rate: number }[];
}

export function TlrefRateChart({ data }: Props) {
  if (!data.length) {
    return (
      <p className="text-data-sm text-muted-foreground py-8 text-center">
        {tr.dashboard.overview.widgets.noRateData}
      </p>
    );
  }

  const last90 = data.slice(-90);
  const tickInterval = Math.max(1, Math.floor(last90.length / 12));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={last90} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={PRIMARY} stopOpacity={0.18} />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: MUTED, fontFamily: "var(--font-inter)" }}
          stroke="transparent"
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis
          tick={{ fontSize: 10, fill: MUTED, fontFamily: "var(--font-inter)" }}
          stroke="transparent"
          tickLine={false}
          tickFormatter={(v) => `%${v.toFixed(3)}`}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
            fontSize: "12px",
            color: "hsl(var(--foreground))",
            boxShadow: "var(--shadow-md)",
          }}
          formatter={(value: number) => [`%${value.toFixed(5)}`, tr.dashboard.overview.widgets.dailyRate]}
          labelStyle={{ color: MUTED, fontSize: "10px", marginBottom: "4px" }}
        />
        <Area
          type="monotone"
          dataKey="rate"
          stroke={PRIMARY}
          strokeWidth={2}
          fill="url(#rateFill)"
          dot={false}
          activeDot={{ r: 4, fill: PRIMARY }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
