"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const MOCK_DATA = [
  { date: "01/01", clean: 97.2, dirty: 98.1 },
  { date: "15/01", clean: 97.8, dirty: 99.2 },
  { date: "01/02", clean: 98.1, dirty: 99.8 },
  { date: "15/02", clean: 98.5, dirty: 98.7 },
  { date: "01/03", clean: 97.9, dirty: 98.4 },
  { date: "15/03", clean: 98.3, dirty: 99.5 },
];

const AMBER = "hsl(40, 55%, 58%)";
const CORAL = "hsl(0, 72%, 51%)";
const GRID = "hsl(225, 15%, 16%)";
const MUTED = "hsl(220, 10%, 35%)";

interface Props {
  data?: { date: string; clean: number; dirty: number }[];
}

export function PriceHistoryChart({ data = MOCK_DATA }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
          labelStyle={{ color: "hsl(220, 10%, 52%)", fontSize: "10px", marginBottom: "4px" }}
        />
        <Legend
          iconType="line"
          wrapperStyle={{ fontSize: "11px", fontFamily: "var(--font-jetbrains-mono)", color: MUTED }}
        />
        <Line name="Temiz Fiyat" type="monotone" dataKey="clean" stroke={AMBER} strokeWidth={1.5} dot={{ r: 2, fill: AMBER }} />
        <Line name="Kirli Fiyat" type="monotone" dataKey="dirty" stroke={CORAL} strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2, fill: CORAL }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
