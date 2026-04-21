"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  CrosshairMode,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";

interface DataPoint {
  time: Time;
  value: number;
}

interface Props {
  data: DataPoint[];
}

export function TlrefRateTVChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    const el = containerRef.current;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "hsl(220, 10%, 45%)",
        fontFamily: "var(--font-jetbrains-mono, monospace)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "hsl(225, 15%, 14%)", style: LineStyle.Dashed },
        horzLines: { color: "hsl(225, 15%, 14%)", style: LineStyle.Dashed },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: "hsl(220, 10%, 40%)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "hsl(225, 20%, 18%)",
        },
        horzLine: {
          color: "hsl(220, 10%, 40%)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "hsl(225, 20%, 18%)",
        },
      },
      rightPriceScale: {
        borderColor: "hsl(225, 15%, 18%)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "hsl(225, 15%, 18%)",
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    chartRef.current = chart;

    const series = chart.addSeries(LineSeries, {
      color: "hsl(40, 84%, 60%)",
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: "hsl(40, 84%, 60%)",
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dashed,
      priceFormat: {
        type: "custom",
        formatter: (price: number) => `%${price.toFixed(2)}`,
        minMove: 0.01,
      },
    });

    series.setData(data);
    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  if (!data.length) {
    return (
      <p className="text-data-sm text-muted-foreground py-8 text-center">
        TLREF oran verisi bulunmuyor
      </p>
    );
  }

  return <div ref={containerRef} className="w-full" />;
}
