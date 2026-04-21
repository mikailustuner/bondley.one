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
import { tr } from "@/locales/tr";

export default function AdminPage() {
  useEffect(() => {
    document.title = `${tr.admin.overview.title} — ${tr.common.brand}`;
    return () => {
      document.title = tr.common.brand;
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
      .catch((e) => setStatsError(e instanceof Error ? e.message : tr.admin.overview.stats.error));
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
      setSyncMessage({ type: "error", text: tr.admin.overview.operations.noSession });
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await api.tlref.syncNow(token);
      const h = result.historical ?? {};
      const d = result.daily ?? {};
      const parts: string[] = [];
      if (h.index_records) parts.push(tr.admin.overview.operations.tlrefHistorical.replace("{count}", h.index_records.toString()));
      if (h.rates_computed) parts.push(tr.admin.overview.operations.tlrefRates.replace("{count}", h.rates_computed.toString()));
      if (d.records) parts.push(tr.admin.overview.operations.tlrefDaily.replace("{count}", d.records.toString()));
      if (h.status === "error") parts.push(tr.admin.overview.operations.tlrefHistError.replace("{error}", h.error));
      if (d.status === "error") parts.push(tr.admin.overview.operations.tlrefDailyError.replace("{error}", d.error));
      setSyncMessage({
        type: h.status === "error" && d.status === "error" ? "error" : "success",
        text: parts.length ? parts.join(" | ") : tr.admin.overview.operations.tlrefSuccess,
      });
      refreshStats();
    } catch (e) {
      setSyncMessage({
        type: "error",
        text: e instanceof Error ? e.message : tr.admin.overview.operations.syncError,
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleBondSync() {
    const token = getToken();
    if (!token) {
      setSyncMessage({ type: "error", text: tr.admin.overview.operations.noSession });
      return;
    }
    setSyncingBonds(true);
    setSyncMessage(null);
    try {
      const result = await api.bonds.sync(token);
      if (result.status === "success") {
        setSyncMessage({
          type: "success",
          text: tr.admin.overview.operations.bondsSuccess
            .replace("{upserted}", result.bonds_upserted.toString())
            .replace("{deactivated}", result.bonds_deactivated.toString()),
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
        text: e instanceof Error ? e.message : tr.admin.overview.operations.syncError,
      });
    } finally {
      setSyncingBonds(false);
    }
  }

  async function handleSyncAll() {
    const token = getToken();
    if (!token) {
      setSyncMessage({ type: "error", text: tr.admin.overview.operations.noSession });
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
      if (h.index_records) parts.push(`${tr.admin.overview.operations.tlref}: ${tr.admin.overview.operations.tlrefHistorical.replace("{count}", h.index_records.toString())}`);
      if (d.records) parts.push(tr.admin.overview.operations.tlrefDaily.replace("{count}", d.records.toString()));
      if (b.bonds_upserted) parts.push(tr.admin.overview.operations.bondsUpdated.replace("{count}", b.bonds_upserted.toString()));
      if (b.bonds_deactivated) parts.push(tr.admin.overview.operations.bondsDeactivated.replace("{count}", b.bonds_deactivated.toString()));
      if (h.status === "error") parts.push(tr.admin.overview.operations.tlrefError.replace("{error}", h.error));
      if (b.status === "error") parts.push(tr.admin.overview.operations.bondsError.replace("{error}", b.error));
      setSyncMessage({
        type: parts.some((p) => p.includes(tr.common.error.toLowerCase())) ? "error" : "success",
        text: parts.length ? parts.join(" | ") : tr.admin.overview.operations.syncSuccess,
      });
      refreshStats();
    } catch (e) {
      setSyncMessage({
        type: "error",
        text: e instanceof Error ? e.message : tr.admin.overview.operations.syncError,
      });
    } finally {
      setSyncingAll(false);
    }
  }

  function exportDataHealthCSV() {
    if (!dataHealth || dataHealth.bonds_with_issues.length === 0) return;

    // Create CSV content
    const headers = [
      tr.admin.overview.health.csvHeaders.isin,
      tr.admin.overview.health.csvHeaders.issuer,
      tr.admin.overview.health.csvHeaders.issues,
      tr.admin.overview.health.csvHeaders.tblisteUpdate,
      tr.admin.overview.health.csvHeaders.maturityDate
    ];
    const rows = dataHealth.bonds_with_issues.map(b => [
      b.isin_code,
      `"${(b.issuer || "").replace(/"/g, '""')}"`,
      `"${b.issues.map(i => i === 'tbliste_outdated' ? tr.admin.overview.health.issues.outdated : tr.admin.overview.health.issues.kapMissing).join(", ")}"`,
      b.tbliste_updated_at ? formatDate(b.tbliste_updated_at.split('T')[0]) : tr.admin.users.details.notSpecified,
      b.maturity_date ? formatDate(b.maturity_date) : tr.admin.users.details.notSpecified
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
      toast.error(tr.components.maintenanceGuard.title, {
        description: error.message || tr.common.error
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
        <h1 className="text-display-md text-foreground">{tr.admin.overview.title}</h1>
        <p className="text-[15px] text-muted-foreground mt-1.5">
          {tr.admin.overview.description}
        </p>
      </div>

      <div className="grid gap-px md:grid-cols-3 bg-border/30 rounded-lg overflow-hidden animate-fade-up-delay-1">
        {statsError && (
          <div className="col-span-3 bg-card p-5 text-data-sm text-destructive">{statsError}</div>
        )}
        {stats && (
          <>
            <div className="bg-card p-5">
              <div className="text-label text-muted-foreground mb-2">{tr.admin.overview.stats.tlref}</div>
              <div className="font-mono-data text-stat text-foreground">
                {formatDecimal(stats.tlref_count, 0)}
              </div>
              <div className="text-label text-muted-foreground/60 mt-1">{tr.admin.overview.stats.tlrefDesc}</div>
            </div>
            <div className="bg-card p-5">
              <div className="text-label text-muted-foreground mb-2">{tr.admin.overview.stats.bonds}</div>
              <div className="font-mono-data text-stat text-primary">
                {formatDecimal(stats.bonds_count, 0)}
              </div>
              <div className="text-label text-muted-foreground/60 mt-1">{tr.admin.overview.stats.bondsDesc}</div>
            </div>
            <div className="bg-card p-5">
              <div className="text-label text-muted-foreground mb-2">{tr.admin.overview.stats.users}</div>
              <div className="font-mono-data text-stat text-foreground">
                {formatDecimal(stats.users_count, 0)}
              </div>
              <div className="text-label text-muted-foreground/60 mt-1">{tr.admin.overview.stats.usersDesc}</div>
            </div>
          </>
        )}
        {!stats && !statsError && (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card p-5">
                <div className="text-label text-muted-foreground animate-pulse">—</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 animate-fade-up-delay-2">
        <Card>
          <CardHeader>
            <CardDescription>{tr.admin.overview.operations.label}</CardDescription>
            <CardTitle className="mt-1">{tr.admin.overview.operations.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="default"
              className="w-full justify-between group"
              onClick={handleSyncAll}
              disabled={anyLoading}
            >
              <span>
                {syncingAll ? tr.admin.overview.operations.syncingAll : tr.admin.overview.operations.syncAll}
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
                <span>{syncing ? tr.admin.overview.operations.syncing : tr.admin.overview.operations.tlref}</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between group"
                onClick={handleBondSync}
                disabled={anyLoading}
              >
                <span>{syncingBonds ? tr.admin.overview.operations.syncing : tr.admin.overview.operations.bonds}</span>
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
            <CardDescription>{tr.admin.overview.system.label}</CardDescription>
            <CardTitle className="mt-1">{tr.admin.overview.system.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">{tr.admin.overview.system.lastTlrefDate}</span>
                <span className="font-mono-data text-label text-foreground">
                  {formatDate(tlrefLatest?.rate_date)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">{tr.admin.overview.system.lastIndexValue}</span>
                <span className="font-mono-data text-label text-primary">
                  {formatDecimal(tlrefLatest?.index_value, 5)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">{tr.admin.overview.system.activeBonds}</span>
                <span className="font-mono-data text-label text-primary">
                  {formatDecimal(stats?.bonds_count, 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">{tr.admin.overview.system.totalTlref}</span>
                <span className="font-mono-data text-label text-foreground">
                  {formatDecimal(stats?.tlref_count, 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-data-sm text-muted-foreground">{tr.admin.overview.system.userCount}</span>
                <span className="font-mono-data text-label text-foreground">
                  {formatDecimal(stats?.users_count, 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="maintenance-mode" className="text-data-sm text-muted-foreground">{tr.admin.overview.system.maintenance}</Label>
                  <span className="text-xs text-muted-foreground/70">{tr.admin.overview.system.maintenanceDesc}</span>
                </div>
                <Switch
                  id="maintenance-mode"
                  checked={maintenanceMode}
                  onCheckedChange={handleToggleMaintenance}
                  disabled={loadingMaintenance}
                />
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-data-sm text-muted-foreground">{tr.admin.overview.system.autoUpdate}</span>
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
              <CardDescription>{tr.admin.overview.health.label}</CardDescription>
              <CardTitle className="mt-1">{tr.admin.overview.health.title}</CardTitle>
            </div>
            {dataHealth && dataHealth.total_issues > 0 && (
              <Button onClick={exportDataHealthCSV} variant="outline" size="sm" className="hidden sm:flex">
                {tr.admin.overview.health.export}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loadingHealth ? (
              <div className="text-sm text-muted-foreground animate-pulse">{tr.admin.overview.health.checking}</div>
            ) : dataHealth ? (
              <div>
                <div className="flex items-center justify-between py-3 border-b border-border/30">
                  <span className="text-data-sm text-muted-foreground">{tr.admin.overview.health.activeBonds}</span>
                  <span className="font-mono-data text-foreground text-sm">{dataHealth.total_active_bonds}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border/30">
                  <span className="text-data-sm text-muted-foreground">{tr.admin.overview.health.issuesCount}</span>
                  <span className={`font-mono-data text-sm font-medium ${dataHealth.total_issues > 0 ? 'text-amber-500' : 'text-positive'}`}>{dataHealth.total_issues}</span>
                </div>

                {dataHealth.total_issues > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-3">{tr.admin.overview.health.description}</p>
                    <div className="sm:hidden mb-4">
                      <Button onClick={exportDataHealthCSV} variant="outline" size="sm" className="w-full">
                        {tr.admin.overview.health.downloadIssues}
                      </Button>
                    </div>
                  </div>
                )}

                {dataHealth.total_issues === 0 && (
                  <div className="mt-4 p-4 rounded-md bg-positive/10 border border-positive/20 text-positive text-sm flex items-center gap-2">
                    {tr.admin.overview.health.allGood}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{tr.admin.overview.health.error}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
