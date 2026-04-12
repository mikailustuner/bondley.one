"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">Veri Kaynagi</h1>
        <p className="text-data-sm text-muted-foreground mt-1">
          Tüm veriler BIST otomatik süreci ile doldurulur; manuel yükleme yapılamaz
        </p>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <CardDescription>BIST OTOMATIK SUREC</CardDescription>
          <CardTitle className="mt-1">Veri Aktarimi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-data-sm text-muted-foreground">
            Tüm veriler (tahviller, piyasa verileri, TLREF) yalnızca BIST&apos;ten internet üzerinden
            indirilen zip/CSV dosyaları ile veritabanına yazan otomatik süreç ile doldurulur. Manuel
            yükleme yapılamaz (admin dahil).
          </p>
        </CardContent>
      </Card>

      <Card className="animate-fade-up-delay-2">
        <CardHeader>
          <CardDescription>ZAMANLANMIS GOREVLER</CardDescription>
            <CardTitle className="mt-1">Otomatik Güncellemeler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-border/30">
              <span className="text-data-sm text-muted-foreground">Günlük TLREF</span>
              <span className="font-mono-data text-label text-primary">HER İŞ GÜNÜ 18:30</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
              <span className="text-data-sm text-muted-foreground">Hesaplama</span>
              <span className="font-mono-data text-label text-primary">HER İŞ GÜNÜ 18:45</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
