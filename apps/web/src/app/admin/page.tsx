"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Database, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default function AdminPage() {
  const [stats, setStats] = useState<{ bonds_count: number; tlref_count: number; users_count: number } | null>(null);
  const [quality, setQuality] = useState<Awaited<ReturnType<typeof api.verified.quality>> | null>(null);
  const [maintenance, setMaintenance] = useState(false);
  const [changingMaintenance, setChangingMaintenance] = useState(false);

  useEffect(() => {
    document.title = "Yönetim — Bondley";
    const token = getToken();
    if (!token) return;
    Promise.all([
      api.admin.stats(token),
      api.verified.quality(token),
      api.system.getMaintenanceStatus(),
    ]).then(([statsResult, qualityResult, maintenanceResult]) => {
      setStats(statsResult);
      setQuality(qualityResult);
      setMaintenance(maintenanceResult.is_maintenance);
    }).catch((reason) => toast.error(reason instanceof Error ? reason.message : "Yönetim verileri yüklenemedi."));
  }, []);

  const toggleMaintenance = async (checked: boolean) => {
    const token = getToken();
    if (!token) return;
    setChangingMaintenance(true);
    try {
      const result = await api.admin.toggleMaintenance(token, checked);
      setMaintenance(result.maintenance_mode);
      toast.success(result.message);
    } finally {
      setChangingMaintenance(false);
    }
  };

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-display-md">Sistem yönetimi</h1>
        <p className="mt-1 text-sm text-muted-foreground">Doğrulanmış veri hattı ve temel operasyon durumu.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          [Database, "Yayımlanan kıymet", stats?.bonds_count ?? "—"],
          [ShieldCheck, "TLREF gözlemi", stats?.tlref_count ?? "—"],
          [Users, "Kullanıcı", stats?.users_count ?? "—"],
        ].map(([Icon, label, value]) => {
          const IconComponent = Icon as typeof Database;
          return (
            <Card key={label as string}>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><IconComponent className="h-4 w-4" />{label as string}</CardTitle></CardHeader>
              <CardContent className="font-mono-data text-3xl font-bold">{String(value)}</CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Veri hattı</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span>Bootstrap</span>
              <Badge variant={quality?.bootstrap?.status === "READY" ? "default" : "secondary"}>{quality?.bootstrap?.status || "NOT_RUN"}</Badge>
            </div>
            <div className="flex items-center justify-between"><span>Beklenen iş günü</span><span>{formatDate(quality?.bootstrap?.requested_business_date)}</span></div>
            <div className="flex items-center justify-between"><span>Son kaynak</span><span className="max-w-64 truncate">{quality?.latest_source?.filename || "—"}</span></div>
            <div className="flex items-center justify-between"><span>Kaynak tazeliği</span><span>{quality?.latest_source?.freshness_status || "—"}</span></div>
            <div className="flex items-center justify-between">
              <span>KAP zenginleştirme</span>
              <Badge variant={quality?.kap_enrichment?.enabled ? "default" : "secondary"}>
                {quality?.kap_enrichment?.enabled ? "Etkin" : "Kapalı"}
              </Badge>
            </div>
            <div className="flex items-center justify-between"><span>KAP bildirim / kupon</span><span className="font-mono-data">{quality?.kap_enrichment ? `${quality.kap_enrichment.disclosures} / ${quality.kap_enrichment.coupon_events}` : "—"}</span></div>
            <div className="flex items-center justify-between"><span>KAP aktif terim / çelişki</span><span className="font-mono-data">{quality?.kap_enrichment ? `${quality.kap_enrichment.active_terms} / ${quality.kap_enrichment.conflicts}` : "—"}</span></div>
            <Button asChild className="w-full"><Link href="/admin/import"><RefreshCw className="mr-2 h-4 w-4" />Import operasyonlarını aç</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Bakım modu</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-2xl border p-4">
              <div>
                <Label htmlFor="maintenance">Kullanıcı erişimini sınırla</Label>
                <p className="mt-1 text-xs text-muted-foreground">Admin erişimi açık kalır.</p>
              </div>
              <Switch id="maintenance" checked={maintenance} disabled={changingMaintenance} onCheckedChange={(value) => void toggleMaintenance(value)} />
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
