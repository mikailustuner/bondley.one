"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const EMERALD = "hsl(160, 84%, 39%)";
const CORAL = "hsl(0, 72%, 51%)";

interface Props {
  data: { date: string; rate: number }[];
}

export function TlrefRateChart({ data }: Props) {
  if (!data.length) {
    return (
      <p className="text-data-sm text-muted-foreground py-8 text-center">
        Oran verisi bulunmuyor
      </p>
    );
  }

  const last90 = data.slice(-90);
  const tickInterval = Math.max(1, Math.floor(last90.length / 12));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={last90} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
          tickFormatter={(v) => `%${v.toFixed(3)}`}
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
          formatter={(value: number) => [`%${value.toFixed(5)}`, "Günlük Oran"]}
          labelStyle={{ color: "hsl(220, 10%, 52%)", fontSize: "10px", marginBottom: "4px" }}
        />
        <Bar dataKey="rate" radius={[2, 2, 0, 0]} maxBarSize={6}>
          {last90.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.rate >= 0 ? EMERALD : CORAL} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
