"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STATS = [
  { label: "AKTIF TAHVIL", value: "24", sub: "Veritabaninda kayitli" },
  { label: "TLREF KAYIT", value: "1,247", sub: "Tarihsel veri" },
  { label: "KULLANICI", value: "5", sub: "1 admin, 4 user" },
];

const LOGS = [
  { action: "BIST otomatik guncelleme", status: "ZAMANLANMIS", type: "positive" as const },
  { action: "TLREF gunluk cekme", status: "BASARILI", type: "positive" as const },
  { action: "Hesaplama: tahviller", status: "TAMAMLANDI", type: "positive" as const },
  { action: "Yeni kullanici eklendi", status: "ADMIN", type: "neutral" as const },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">Yonetim Paneli</h1>
        <p className="text-data-sm text-muted-foreground mt-1">Sistem yonetimi ve veri operasyonlari</p>
      </div>

      <div className="grid gap-px md:grid-cols-3 bg-border/30 rounded-lg overflow-hidden animate-fade-up-delay-1">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-card p-5 grain">
            <div className="text-label text-muted-foreground mb-2">{stat.label}</div>
            <div className="font-mono-data text-stat text-foreground">{stat.value}</div>
            <div className="text-label text-muted-foreground/60 mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 animate-fade-up-delay-2">
        <Card>
          <CardHeader>
            <CardDescription>OPERASYONLAR</CardDescription>
            <CardTitle className="mt-1">Hizli Islemler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "TLREF Gunluk Veri Cek",
              "TLREF Tarihsel Veri Cek",
              "Tum Hesaplamalari Calistir",
            ].map((label) => (
              <Button key={label} variant="outline" className="w-full justify-between group">
                <span>{label}</span>
                <span className="text-muted-foreground/40 group-hover:text-primary transition-colors">&rarr;</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>SISTEM LOGLARI</CardDescription>
            <CardTitle className="mt-1">Son Islemler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {LOGS.map((log, i) => (
                <div key={i} className="flex justify-between items-center py-2.5 border-b border-border/30 last:border-0">
                  <span className="text-data-sm text-muted-foreground">{log.action}</span>
                  <span className={`font-mono-data text-label ${log.type === "positive" ? "text-positive" : "text-primary"}`}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
