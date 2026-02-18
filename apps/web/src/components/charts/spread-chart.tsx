"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const EMERALD = "hsl(160, 84%, 39%)";
const GRID = "hsl(225, 15%, 16%)";
const MUTED = "hsl(220, 10%, 35%)";

interface Props {
  data: { date: string; spread: number }[];
}

export function SpreadChart({ data }: Props) {
  if (!data.length) {
    return <p className="text-data-sm text-muted-foreground py-8 text-center">Spread verisi bulunmuyor</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="none" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: MUTED, fontFamily: "var(--font-jetbrains-mono)" }}
          stroke="transparent"
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: MUTED, fontFamily: "var(--font-jetbrains-mono)" }}
          stroke="transparent"
          tickLine={false}
          tickFormatter={(v) => `${v}bp`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(225, 20%, 9%)",
            border: "1px solid hsl(225, 15%, 20%)",
            borderRadius: "4px",
            fontSize: "12px",
            fontFamily: "var(--font-jetbrains-mono)",
            color: "hsl(40, 10%, 92%)",
          }}
          formatter={(value: number) => [`${value} bp`, "Spread"]}
          labelStyle={{ color: "hsl(220, 10%, 52%)", fontSize: "10px", marginBottom: "4px" }}
        />
        <defs>
          <linearGradient id="spreadFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EMERALD} stopOpacity={0.2} />
            <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="spread"
          stroke={EMERALD}
          strokeWidth={1.5}
          fill="url(#spreadFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
