"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const AMBER = "hsl(40, 55%, 58%)";
const GRID = "hsl(225, 15%, 16%)";
const MUTED = "hsl(220, 10%, 35%)";

interface Props {
  data: { maturity: string; ytm: number }[];
}

export function YieldCurveChart({ data }: Props) {
  if (!data.length) {
    return <p className="text-data-sm text-muted-foreground py-8 text-center">Getiri egrisi verisi bulunmuyor</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="none" vertical={false} />
        <XAxis
          dataKey="maturity"
          tick={{ fontSize: 10, fill: MUTED, fontFamily: "var(--font-jetbrains-mono)" }}
          stroke="transparent"
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: MUTED, fontFamily: "var(--font-jetbrains-mono)" }}
          stroke="transparent"
          tickLine={false}
          tickFormatter={(v) => `%${v}`}
          domain={["auto", "auto"]}
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
          formatter={(value: number) => [`%${value.toFixed(2)}`, "YTM"]}
          labelStyle={{ color: "hsl(220, 10%, 52%)", fontSize: "10px", marginBottom: "4px" }}
        />
        <Line
          type="monotone"
          dataKey="ytm"
          stroke={AMBER}
          strokeWidth={2}
          dot={{ fill: "hsl(225, 20%, 9%)", stroke: AMBER, strokeWidth: 2, r: 3 }}
          activeDot={{ fill: AMBER, stroke: "hsl(225, 20%, 9%)", strokeWidth: 2, r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
