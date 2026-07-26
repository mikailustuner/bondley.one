"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

type Operations = Awaited<ReturnType<typeof api.verified.importOperations>>;

export default function ImportPage() {
  const [operations, setOperations] = useState<Operations | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      setOperations(await api.verified.importOperations(token));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const bootstrap = async () => {
    const token = getToken();
    if (!token) return;
    setRunning(true);
    setMessage(null);
    try {
      const result = await api.verified.runBootstrap(token, true);
      setMessage(`Bootstrap ${result.status}: ${result.requested_business_date}`);
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Bootstrap başlatılamadı.");
    } finally {
      setRunning(false);
    }
  };

  const latestBootstrap = operations?.bootstraps[0];

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-md">Veri içe aktarma</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            İlk açılış, kaynak tarihi, hash, parser sürümü ve kalite kapıları burada izlenir.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Yenile
          </Button>
          <Button onClick={() => void bootstrap()} disabled={running}>
            {running ? "Çalışıyor…" : "Bootstrap’ı yeniden çalıştır"}
          </Button>
        </div>
      </header>

      {message && <div className="rounded-2xl border bg-muted/40 p-4 text-sm">{message}</div>}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Son bootstrap</CardTitle></CardHeader>
          <CardContent>
            <Badge variant={latestBootstrap?.status === "READY" ? "default" : "secondary"}>
              {latestBootstrap?.status || "Henüz çalışmadı"}
            </Badge>
            <p className="mt-3 text-xs text-muted-foreground">{latestBootstrap?.current_step || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Beklenen iş günü</CardTitle></CardHeader>
          <CardContent className="font-mono-data text-xl font-bold">
            {latestBootstrap ? formatDate(latestBootstrap.requested_business_date) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Otomatik program</CardTitle></CardHeader>
          <CardContent className="text-sm">
            16:30 benchmark · 16:35 tbliste
            <p className="mt-2 text-xs text-muted-foreground">Europe/Istanbul</p>
          </CardContent>
        </Card>
      </section>

      {latestBootstrap?.failure_message && (
        <div className="flex gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" /> {latestBootstrap.failure_message}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Son içe aktarmalar</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-3">Kaynak</th>
                <th>Veri / beklenen tarih</th>
                <th>Durum</th>
                <th>Satır / kıymet</th>
                <th>Uyarı / hata</th>
                <th>SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {operations?.imports.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-3">
                    <span className="block font-medium">{item.source.kind}</span>
                    <span className="block max-w-56 truncate text-xs text-muted-foreground">{item.source.filename}</span>
                  </td>
                  <td>
                    <span className="block">{formatDate(item.source.effective_date)}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(item.source.requested_business_date)}</span>
                  </td>
                  <td>
                    <Badge variant={item.status === "PUBLISHED" ? "default" : "secondary"}>{item.status}</Badge>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.source.freshness_status}</span>
                  </td>
                  <td className="font-mono-data">{item.row_count} / {item.instrument_count}</td>
                  <td className="font-mono-data">{item.warning_count} / {item.error_count}</td>
                  <td className="font-mono-data text-xs" title={item.source.sha256}>
                    {item.source.sha256.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !operations?.imports.length && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <ShieldCheck className="h-5 w-5" /> Henüz import kaydı yok.
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
