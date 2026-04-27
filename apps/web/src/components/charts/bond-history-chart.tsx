"use client";

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
import { formatDate } from "@/lib/utils";

interface HistoryPoint {
  date: string;
  clean_price: number | null;
  ytm: number | null;
}

export function BondHistoryChart({ data }: { data: HistoryPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
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
  );
}
