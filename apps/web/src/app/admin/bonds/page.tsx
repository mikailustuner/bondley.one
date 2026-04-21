"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, BondListItem } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatPercent } from "@/lib/utils";

import { tr } from "@/locales/tr";

export default function AdminBondsPage() {
  const [bonds, setBonds] = useState<BondListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function fetchBonds() {
    const token = getToken();
    if (!token) {
      setLoading(false);
      setError(tr.dashboard.admin.overview.operations.noSession);
      return;
    }
    setLoading(true);
    api.bonds
      .list(token, { active_only: false, limit: 3000 })
      .then((res) => {
        setBonds(res.items || []);
        setTotal(res.total ?? 0);
      })
      .catch((err) => setError(err?.message || tr.dashboard.overview.widgets.noRateData))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchBonds();
  }, []);

  async function handleSync() {
    const token = getToken();
    if (!token) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await api.bonds.sync(token);
      if (result.status === "success") {
        setSyncMsg(tr.dashboard.admin.overview.operations.bondsSuccess
          .replace("{upserted}", (result.bonds_upserted ?? 0).toString())
          .replace("{deactivated}", (result.bonds_deactivated ?? 0).toString()));
        fetchBonds();
      } else {
        setSyncMsg(`${tr.common.error}: ${(result as any).error || "Bilinmeyen"}`);
      }
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : tr.dashboard.admin.overview.operations.syncError);
    } finally {
      setSyncing(false);
    }
  }

  const filtered = search.trim()
    ? bonds.filter(
        (b) =>
          b.isin_code.toUpperCase().includes(search.toUpperCase()) ||
          (b.issuer && b.issuer.toUpperCase().includes(search.toUpperCase())),
      )
    : bonds;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display text-display-md text-foreground">{tr.dashboard.admin.bonds.title}</h1>
          <p className="text-data-sm text-muted-foreground mt-1">
            {tr.dashboard.admin.bonds.description}
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? tr.dashboard.admin.overview.operations.syncing : tr.dashboard.admin.bonds.syncButton}
        </Button>
      </div>

      {syncMsg && (
        <p className="text-data-sm text-positive animate-fade-up">{syncMsg}</p>
      )}

      <div className="w-64 animate-fade-up">
        <Input
          placeholder={tr.dashboard.admin.bonds.searchPlaceholder}
          className="font-mono-data"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>{tr.dashboard.admin.bonds.card.label}</CardDescription>
              <CardTitle className="mt-1">{tr.dashboard.admin.bonds.card.title}</CardTitle>
            </div>
            {!loading && (
              <span className="text-label text-muted-foreground">
                {search ? `${filtered.length} / ` : ""}
                {total} {tr.dashboard.admin.bonds.card.records}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="text-data-sm text-muted-foreground py-4">{tr.common.loading}</p>
          )}
          {error && <p className="text-data-sm text-destructive py-4">{error}</p>}
          {!loading && !error && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    {[
                      tr.dashboard.admin.bonds.table.isin,
                      tr.dashboard.admin.bonds.table.issuer,
                      tr.dashboard.admin.bonds.table.type,
                      tr.dashboard.admin.bonds.table.currency,
                      tr.dashboard.admin.bonds.table.maturity,
                      tr.dashboard.admin.bonds.table.yield,
                      tr.dashboard.admin.bonds.table.status
                    ].map(
                      (h) => (
                        <th
                          key={h}
                          scope="col"
                          className="pb-3 text-label text-muted-foreground font-normal text-left"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((bond) => (
                    <tr
                      key={bond.isin_code}
                      className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="py-3 font-mono-data text-data-sm text-foreground">
                        {bond.isin_code}
                      </td>
                      <td className="py-3 text-data-sm text-muted-foreground max-w-[180px] truncate">
                        {bond.issuer
                          ? bond.issuer.length > 30
                            ? bond.issuer.substring(0, 30) + "…"
                            : bond.issuer
                          : "—"}
                      </td>
                      <td className="py-3 text-data-sm text-muted-foreground">
                        {bond.security_type
                          ? bond.security_type.split("/")[0].trim().substring(0, 20)
                          : "—"}
                      </td>
                      <td className="py-3">
                        <Badge variant="outline">{bond.currency}</Badge>
                      </td>
                      <td className="py-3 font-mono-data text-data-sm text-muted-foreground">
                        {bond.days_to_maturity ?? "—"}
                      </td>
                      <td className="py-3 font-mono-data text-data-sm text-positive">
                        {bond.last_issue_yield != null ? formatPercent(bond.last_issue_yield) : "—"}
                      </td>
                      <td className="py-3">
                        <Badge variant={bond.is_active ? "default" : "destructive"}>
                          {bond.is_active ? tr.dashboard.admin.users.status.active : tr.dashboard.admin.users.status.passive}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-data-sm text-muted-foreground py-6 text-center">
                  {tr.dashboard.admin.bonds.card.notFound}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
