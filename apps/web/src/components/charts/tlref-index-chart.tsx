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

const AMBER = "hsl(40, 55%, 58%)";
const GRID = "hsl(var(--border))";
const MUTED = "hsl(var(--muted-foreground))";

interface Props {
  data: { date: string; value: number }[];
}

export function TlrefIndexChart({ data }: Props) {
  if (!data.length) {
    return (
      <p className="text-data-sm text-muted-foreground py-8 text-center">
        Endeks verisi bulunmuyor
      </p>
    );
  }

  const tickInterval = Math.max(1, Math.floor(data.length / 12));

  return (
    <ResponsiveContainer width="100%" height={340}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 16%)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "hsl(220, 10%, 45%)", fontFamily: "var(--font-jetbrains-mono)" }}
          stroke="transparent"
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "hsl(220, 10%, 45%)", fontFamily: "var(--font-jetbrains-mono)" }}
          stroke="transparent"
          tickLine={false}
          domain={["auto", "auto"]}
          tickFormatter={(v) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
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
          formatter={(value: number) => [
            value.toLocaleString("tr-TR", { maximumFractionDigits: 5 }),
            "Endeks",
          ]}
          labelStyle={{ color: "hsl(220, 10%, 52%)", fontSize: "10px", marginBottom: "4px" }}
        />
        <defs>
          <linearGradient id="indexFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AMBER} stopOpacity={0.25} />
            <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={AMBER}
          strokeWidth={2}
          fill="url(#indexFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
