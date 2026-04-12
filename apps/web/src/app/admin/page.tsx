"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { getToken } from "@/lib/auth";
import { formatDecimal, formatDate } from "@/lib/utils";

export default function AdminPage() {
  useEffect(() => {
    document.title = "Yönetim Paneli — Bondley";
    return () => {
      document.title = "Bondley";
    };
  }, []);
  const [syncing, setSyncing] = useState(false);
  const [syncingBonds, setSyncingBonds] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
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

  const [dataHealth, setDataHealth] = useState<{
    total_active_bonds: number;
    total_issues: number;
    bonds_with_issues: Array<{
      isin_code: string;
      issuer: string | null;
      maturity_date: string | null;
      issue_date: string | null;
      tbliste_updated_at: string | null;
      issues: string[];
    }>;
  } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);

  function refreshStats() {
    const token = getToken();
    if (!token) return;
    api.admin.stats(token).then(setStats).catch(() => { });
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
      .catch(() => { });
    loadDataHealth();
  }

  async function loadDataHealth() {
    const token = getToken();
    if (!token) return;
    setLoadingHealth(true);
    try {
      const result = await api.admin.getDataHealth(token);
      setDataHealth(result);
    } catch (e) {
      console.error("Data health yuklenemedi", e);
    } finally {
      setLoadingHealth(false);
    }
  }

  async function loadMaintenanceStatus() {
    try {
      setLoadingMaintenance(true);
      const res = await api.system.getMaintenanceStatus();
      setMaintenanceMode(res.is_maintenance);
    } catch (e) {
      console.error("Maintenance status yuklenemedi", e);
    } finally {
      setLoadingMaintenance(false);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.admin
      .stats(token)
      .then(setStats)
      .catch((e) => setStatsError(e instanceof Error ? e.message : "İstatistik yüklenemedi"));
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
      .catch(() => { });

    loadDataHealth();
    loadMaintenanceStatus();
  }, []);

  async function handleTlrefSync() {
    const token = getToken();
    if (!token) {
      setSyncMessage({ type: "error", text: "Oturum açık değil." });
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await api.tlref.syncNow(token);
      const h = result.historical ?? {};
      const d = result.daily ?? {};
      const parts: string[] = [];
      if (h.index_records) parts.push(`${h.index_records} tarihsel endeks kaydı`);
      if (h.rates_computed) parts.push(`${h.rates_computed} günlük oran hesaplandı`);
      if (d.records) parts.push(`${d.records} günlük kayıt`);
      if (h.status === "error") parts.push(`Tarihsel hata: ${h.error}`);
      if (d.status === "error") parts.push(`Günlük hata: ${d.error}`);
      setSyncMessage({
        type: h.status === "error" && d.status === "error" ? "error" : "success",
        text: parts.length ? parts.join(" | ") : "TLREF sync tamamlandı.",
      });
      refreshStats();
    } catch (e) {
      setSyncMessage({
        type: "error",
        text: e instanceof Error ? e.message : "TLREF sync başarısız.",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleBondSync() {
    const token = getToken();
    if (!token) {
      setSyncMessage({ type: "error", text: "Oturum açık değil." });
      return;
    }
    setSyncingBonds(true);
    setSyncMessage(null);
    try {
      const result = await api.bonds.sync(token);
      if (result.status === "success") {
        setSyncMessage({
          type: "success",
          text: `${result.bonds_upserted} tahvil güncellendi, ${result.bonds_deactivated} deaktive edildi.`,
        });
      } else {
        setSyncMessage({
          type: "error",
          text: `Tahvil sync hatasi: ${(result as any).error || "Bilinmeyen hata"}`,
        });
      }
      refreshStats();
    } catch (e) {
      setSyncMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Tahvil sync başarısız.",
      });
    } finally {
      setSyncingBonds(false);
    }
  }

  async function handleSyncAll() {
    const token = getToken();
    if (!token) {
      setSyncMessage({ type: "error", text: "Oturum açık değil." });
      return;
    }
    setSyncingAll(true);
    setSyncMessage(null);
    try {
      const result = await api.admin.syncAll(token);
      const parts: string[] = [];
      const h = result.tlref_historical ?? {};
      const d = result.tlref_daily ?? {};
      const b = result.bonds ?? {};
      if (h.index_records) parts.push(`TLREF: ${h.index_records} tarihsel`);
      if (d.records) parts.push(`${d.records} günlük`);
      if (b.bonds_upserted) parts.push(`Tahvil: ${b.bonds_upserted} güncellendi`);
      if (b.bonds_deactivated) parts.push(`${b.bonds_deactivated} deaktive`);
      if (h.status === "error") parts.push(`TLREF hata: ${h.error}`);
      if (b.status === "error") parts.push(`Tahvil hata: ${b.error}`);
      setSyncMessage({
        type: parts.some((p) => p.includes("hata")) ? "error" : "success",
        text: parts.length ? parts.join(" | ") : "Tüm veriler güncellendi.",
      });
      refreshStats();
    } catch (e) {
      setSyncMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Sync başarısız.",
      });
    } finally {
      setSyncingAll(false);
    }
  }

  function exportDataHealthCSV() {
    if (!dataHealth || dataHealth.bonds_with_issues.length === 0) return;

    // Create CSV content
    const headers = ["ISIN", "Sirket", "Sorunlar", "tbliste_Son_Guncelleme", "Itfa_Tarihi"];
    const rows = dataHealth.bonds_with_issues.map(b => [
      b.isin_code,
      `"${(b.issuer || "").replace(/"/g, '""')}"`,
      `"${b.issues.map(i => i === 'tbliste_outdated' ? 'tbliste guncellenmedi' : 'KAP verisi eksik').join(", ")}"`,
      b.tbliste_updated_at ? formatDate(b.tbliste_updated_at.split('T')[0]) : "Yok",
      b.maturity_date ? formatDate(b.maturity_date) : "Yok"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `eksik_verili_tahviller_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleToggleMaintenance(checked: boolean) {
    const token = getToken();
    if (!token) return;

    setLoadingMaintenance(true);
    try {
      const res = await api.admin.toggleMaintenance(token, checked);
      setMaintenanceMode(res.maintenance_mode);
      toast.success(res.message);
    } catch (error: any) {
      toast.error("Bakım modu güncellenemedi", {
        description: error.message || "Bir hata oluştu."
      });
      // Revert optimism
      setMaintenanceMode(!checked);
    } finally {
      setLoadingMaintenance(false);
    }
  }

  const anyLoading = syncing || syncingBonds || syncingAll;

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">Yönetim Paneli</h1>
        <p className="text-data-sm text-muted-foreground mt-1">
          Sistem yönetimi ve veri operasyonları
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
                {formatDecimal(stats.tlref_count, 0)}
              </div>
              <div className="text-label text-muted-foreground/60 mt-1">Endeks kaydi</div>
            </div>
            <div className="bg-card p-5 grain amber-glow-border">
              <div className="text-label text-muted-foreground mb-2">TAHVIL</div>
              <div className="font-mono-data text-stat text-primary">
                {formatDecimal(stats.bonds_count, 0)}
              </div>
              <div className="text-label text-muted-foreground/60 mt-1">Aktif borclanma araci</div>
            </div>
            <div className="bg-card p-5 grain">
              <div className="text-label text-muted-foreground mb-2">KULLANICI</div>
              <div className="font-mono-data text-stat text-foreground">
                {formatDecimal(stats.users_count, 0)}
              </div>
              <div className="text-label text-muted-foreground/60 mt-1">Kayıtlı hesap</div>
            </div>
          </>
        )}
        {!stats && !statsError && (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card p-5 grain">
                <div className="text-label text-muted-foreground animate-pulse">—</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 animate-fade-up-delay-2">
        <Card>
          <CardHeader>
            <CardDescription>OPERASYONLAR</CardDescription>
            <CardTitle className="mt-1">Veri Güncelleme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="default"
              className="w-full justify-between group"
              onClick={handleSyncAll}
              disabled={anyLoading}
            >
              <span>
                {syncingAll ? "Tüm veriler güncelleniyor…" : "Tüm Verileri Güncelle (TLREF + Tahvil)"}
              </span>
              <span className="text-muted-foreground/40 group-hover:text-primary transition-colors">
                &rarr;
              </span>
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="w-full justify-between group"
                onClick={handleTlrefSync}
                disabled={anyLoading}
              >
                <span>{syncing ? "Güncelleniyor…" : "TLREF Endeks"}</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between group"
                onClick={handleBondSync}
                disabled={anyLoading}
              >
                <span>{syncingBonds ? "Güncelleniyor…" : "Tahvil Listesi"}</span>
              </Button>
            </div>

            {syncMessage && (
              <p
                className={`text-data-sm mt-2 ${syncMessage.type === "success" ? "text-positive" : "text-destructive"}`}
              >
                {syncMessage.text}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>SISTEM DURUMU</CardDescription>
            <CardTitle className="mt-1">Genel Bakış</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">Son TLREF Tarihi</span>
                <span className="font-mono-data text-label text-foreground">
                  {formatDate(tlrefLatest?.rate_date)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">Son Endeks Değeri</span>
                <span className="font-mono-data text-label text-primary">
                  {formatDecimal(tlrefLatest?.index_value, 5)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">Aktif Tahvil</span>
                <span className="font-mono-data text-label text-primary">
                  {formatDecimal(stats?.bonds_count, 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">Toplam TLREF Kaydı</span>
                <span className="font-mono-data text-label text-foreground">
                  {formatDecimal(stats?.tlref_count, 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">Kullanıcı Sayısı</span>
                <span className="font-mono-data text-label text-foreground">
                  {formatDecimal(stats?.users_count, 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="maintenance-mode" className="text-data-sm text-muted-foreground">Bakım Modu (Site Under Construction)</Label>
                  <span className="text-xs text-muted-foreground/70">Ziyaretçilere bakımdayız sayfasını gösterir</span>
                </div>
                <Switch
                  id="maintenance-mode"
                  checked={maintenanceMode}
                  onCheckedChange={handleToggleMaintenance}
                  disabled={loadingMaintenance}
                />
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-data-sm text-muted-foreground">Otomatik Güncelleme</span>
                <span className="font-mono-data text-label text-positive">
                  TLREF 18:30 / TAHVIL 19:00
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Veri Sağlığı / Data Health Kartı */}
      <div className="grid gap-6 md:grid-cols-1 animate-fade-up-delay-3">
        <Card className={dataHealth && dataHealth.total_issues > 0 ? "border-amber-500/30" : ""}>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardDescription>VERİ SAĞLIĞI & EKSİKLİKLER</CardDescription>
              <CardTitle className="mt-1">KAP ve tbliste Veri Kontrolü</CardTitle>
            </div>
            {dataHealth && dataHealth.total_issues > 0 && (
              <Button onClick={exportDataHealthCSV} variant="outline" size="sm" className="hidden sm:flex">
                CSV Olarak İndir
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loadingHealth ? (
              <div className="text-sm text-muted-foreground animate-pulse">Kontrol ediliyor...</div>
            ) : dataHealth ? (
              <div>
                <div className="flex items-center justify-between py-3 border-b border-border/30">
                  <span className="text-data-sm text-muted-foreground">Aktif Tahvil Sayısı</span>
                  <span className="font-mono-data text-foreground text-sm">{dataHealth.total_active_bonds}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border/30">
                  <span className="text-data-sm text-muted-foreground">Sorunlu / Eksik Kayıt Sayısı</span>
                  <span className={`font-mono-data text-sm font-medium ${dataHealth.total_issues > 0 ? 'text-amber-500' : 'text-positive'}`}>{dataHealth.total_issues}</span>
                </div>

                {dataHealth.total_issues > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-3">Aşağıdaki tahvillerin ya hiç KAP verisi yok, ya da BİAŞ (tbliste) listesinde güncellenmemiş durumda.</p>
                    <div className="sm:hidden mb-4">
                      <Button onClick={exportDataHealthCSV} variant="outline" size="sm" className="w-full">
                        Eksik Listesini İndir (CSV)
                      </Button>
                    </div>
                  </div>
                )}

                {dataHealth.total_issues === 0 && (
                  <div className="mt-4 p-4 rounded-md bg-positive/10 border border-positive/20 text-positive text-sm flex items-center gap-2">
                    ✓ Tüm aktif tahvillerin KAP ve güncel tbliste verileri eksiksiz bulunuyor.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Veri sağlığı durumu alınamadı.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
