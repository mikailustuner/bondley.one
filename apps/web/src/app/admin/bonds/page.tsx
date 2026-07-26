"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, VerifiedInstrument } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default function AdminBondsPage() {
  const [items, setItems] = useState<VerifiedInstrument[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const result = await api.verified.list(token, {
      limit: 250,
      search: search.trim() || undefined,
      active_only: false,
    });
    setItems(result.items);
    setTotal(result.total);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const sync = async () => {
    const token = getToken();
    if (!token) return;
    setSyncing(true);
    try {
      const result = await api.bonds.sync(token);
      setMessage(`${result.status}: doğrulanmış tbliste işlendi.`);
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Import tamamlanamadı.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-md">Doğrulanmış kıymetler</h1>
          <p className="mt-1 text-sm text-muted-foreground">Parser kalitesi ve yayımlanan sürümler.</p>
        </div>
        <Button onClick={() => void sync()} disabled={syncing}>{syncing ? "İşleniyor…" : "tbliste içe aktar"}</Button>
      </header>
      {message && <div className="rounded-xl border bg-muted/30 p-3 text-sm">{message}</div>}
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ISIN veya ihraççı ara" className="max-w-md" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Kayıtlar</span><span className="text-sm font-normal text-muted-foreground">{total} kıymet</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr><th className="py-3">ISIN / ihraççı</th><th>Vade</th><th>Aile</th><th>Parse</th><th>Uygunluk</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-3">
                    <Link href={`/dashboard/bonds/${item.isin}`} className="font-mono-data font-semibold text-primary">{item.isin}</Link>
                    <span className="block max-w-md truncate text-xs text-muted-foreground">{item.issuer || "—"}</span>
                  </td>
                  <td>{formatDate(item.maturity_date)}</td>
                  <td>{item.instrument_family === "PARTICIPATION" ? "TRD / TLREFK" : "Standart"}</td>
                  <td><Badge variant={item.quality.parse_status === "EXACT" ? "default" : "secondary"}>{item.quality.parse_status}</Badge></td>
                  <td>{item.quality.valuation_eligible ? "Uygun" : "İnceleme gerekli"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  );
}
