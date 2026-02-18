"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

export default function AdminPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [stats, setStats] = useState<{
    bonds_count: number;
    tlref_count: number;
    users_count: number;
  } | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [tlrefLatest, setTlrefLatest] = useState<{
    rate_date: string;
    index_value: number;
    daily_rate: number | null;
  } | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.admin
      .stats(token)
      .then(setStats)
      .catch((e) => setStatsError(e instanceof Error ? e.message : "Istatistik yuklenemedi"));

    api.tlref
      .latest(token)
      .then((res) => {
        if (res)
          setTlrefLatest({
            rate_date: res.rate_date,
            index_value: res.index_value,
            daily_rate: res.daily_rate,
          });
      })
      .catch(() => {});
  }, []);

  async function handleSync() {
    const token = getToken();
    if (!token) {
      setSyncMessage({ type: "error", text: "Oturum acik degil." });
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await api.tlref.syncNow(token);
      const h = result.historical ?? {};
      const d = result.daily ?? {};
      const parts: string[] = [];

      if (h.index_records) parts.push(`${h.index_records} tarihsel endeks kaydi`);
      if (h.rates_computed) parts.push(`${h.rates_computed} gunluk oran hesaplandi`);
      if (d.records) parts.push(`${d.records} gunluk kayit`);
      if (h.status === "error") parts.push(`Tarihsel hata: ${h.error}`);
      if (d.status === "error") parts.push(`Gunluk hata: ${d.error}`);

      setSyncMessage({
        type: h.status === "error" && d.status === "error" ? "error" : "success",
        text: parts.length ? parts.join(" | ") : "Sync tamamlandi.",
      });

      const t = getToken();
      if (t) api.admin.stats(t).then(setStats).catch(() => {});
      if (t)
        api.tlref
          .latest(t)
          .then((res) => {
            if (res)
              setTlrefLatest({
                rate_date: res.rate_date,
                index_value: res.index_value,
                daily_rate: res.daily_rate,
              });
          })
          .catch(() => {});
    } catch (e) {
      setSyncMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Sync basarisiz.",
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">Yonetim Paneli</h1>
        <p className="text-data-sm text-muted-foreground mt-1">
          Sistem yonetimi ve veri operasyonlari
        </p>
      </div>

      <div className="grid gap-px md:grid-cols-3 bg-border/30 rounded-lg overflow-hidden animate-fade-up-delay-1">
        {statsError && (
          <div className="col-span-3 bg-card p-5 text-data-sm text-destructive">{statsError}</div>
        )}
        {stats && (
          <>
            <div className="bg-card p-5 grain">
              <div className="text-label text-muted-foreground mb-2">TLREF KAYIT</div>
              <div className="font-mono-data text-stat text-foreground">
                {stats.tlref_count.toLocaleString("tr-TR")}
              </div>
              <div className="text-label text-muted-foreground/60 mt-1">Endeks kaydi</div>
            </div>
            <div className="bg-card p-5 grain">
              <div className="text-label text-muted-foreground mb-2">TAHVIL</div>
              <div className="font-mono-data text-stat text-foreground">
                {stats.bonds_count.toLocaleString("tr-TR")}
              </div>
              <div className="text-label text-muted-foreground/60 mt-1">Veritabaninda kayitli</div>
            </div>
            <div className="bg-card p-5 grain">
              <div className="text-label text-muted-foreground mb-2">KULLANICI</div>
              <div className="font-mono-data text-stat text-foreground">
                {stats.users_count.toLocaleString("tr-TR")}
              </div>
              <div className="text-label text-muted-foreground/60 mt-1">Kayitli hesap</div>
            </div>
          </>
        )}
        {!stats && !statsError && (
          <>
            <div className="bg-card p-5 grain">
              <div className="text-label text-muted-foreground animate-pulse">—</div>
            </div>
            <div className="bg-card p-5 grain">
              <div className="text-label text-muted-foreground animate-pulse">—</div>
            </div>
            <div className="bg-card p-5 grain">
              <div className="text-label text-muted-foreground animate-pulse">—</div>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 animate-fade-up-delay-2">
        <Card>
          <CardHeader>
            <CardDescription>OPERASYONLAR</CardDescription>
            <CardTitle className="mt-1">Hizli Islemler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="default"
              className="w-full justify-between group"
              onClick={handleSync}
              disabled={syncing}
            >
              <span>{syncing ? "Guncelleniyor…" : "TLREF Endeks Verilerini Guncelle"}</span>
              <span className="text-muted-foreground/40 group-hover:text-primary transition-colors">
                &rarr;
              </span>
            </Button>
            {syncMessage && (
              <p
                className={`text-data-sm ${syncMessage.type === "success" ? "text-positive" : "text-destructive"}`}
              >
                {syncMessage.text}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>SISTEM DURUMU</CardDescription>
            <CardTitle className="mt-1">Genel Bakis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">Son TLREF Tarihi</span>
                <span className="font-mono-data text-label text-foreground">
                  {tlrefLatest
                    ? new Date(tlrefLatest.rate_date).toLocaleDateString("tr-TR")
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">Son Endeks Degeri</span>
                <span className="font-mono-data text-label text-primary">
                  {tlrefLatest
                    ? tlrefLatest.index_value.toLocaleString("tr-TR", {
                        maximumFractionDigits: 5,
                      })
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">Son Gunluk Oran</span>
                <span className="font-mono-data text-label text-positive">
                  {tlrefLatest?.daily_rate != null
                    ? `%${(tlrefLatest.daily_rate * 100).toFixed(5)}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">Toplam TLREF Kaydi</span>
                <span className="font-mono-data text-label text-foreground">
                  {stats ? stats.tlref_count.toLocaleString("tr-TR") : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">Kullanici Sayisi</span>
                <span className="font-mono-data text-label text-foreground">
                  {stats ? stats.users_count.toLocaleString("tr-TR") : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-data-sm text-muted-foreground">Otomatik Guncelleme</span>
                <span className="font-mono-data text-label text-positive">HER IS GUNU 18:30</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
