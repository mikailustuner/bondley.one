"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { YieldCurveChart } from "@/components/charts/yield-curve-chart";
import { SpreadChart } from "@/components/charts/spread-chart";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">Analiz</h1>
        <p className="text-data-sm text-muted-foreground mt-1">Tahvil piyasasi analiz grafikleri</p>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>GETIRI EGRISI</CardDescription>
              <CardTitle className="mt-1">Yield Curve — TRT Tahvilleri</CardTitle>
            </div>
            <Badge variant="outline">TUM VADELER</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <YieldCurveChart />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 animate-fade-up-delay-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>SPREAD TRENDI</CardDescription>
                <CardTitle className="mt-1">vs TLREF</CardTitle>
              </div>
              <Badge variant="outline">30G</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SpreadChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>FIYAT KARSILASTIRMASI</CardDescription>
                <CardTitle className="mt-1">Temiz / Kirli Fiyat</CardTitle>
              </div>
              <Badge variant="outline">6A</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <PriceHistoryChart />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
