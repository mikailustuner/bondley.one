"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { AlertCircle, Inbox } from "lucide-react";
import { api, BondListItem, BondStats } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDecimal, formatPercentFromDecimal, formatPercent, formatDate } from "@/lib/utils";

const CURRENCY_COLORS: Record<string, string> = {
  TRY: "default",
  USD: "secondary",
  EUR: "outline",
};

export default function BondsListPage() {
  useEffect(() => {
    document.title = "Tahviller — Bondley";
    return () => {
      document.title = "Bondley";
    };
  }, []);
  const [bonds, setBonds] = useState<BondListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<BondStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Giriş yapmanız gerekiyor");
      setLoading(false);
      return;
    }

    Promise.all([
      api.bonds.list(token, { active_only: true, limit: 3000 }),
      api.bonds.stats(token),
    ])
      .then(([listRes, statsRes]) => {
        setBonds(listRes.items || []);
        setTotal(listRes.total ?? 0);
        setStats(statsRes);
      })
      .catch((e) => setError(e?.message || "Veri yuklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = bonds;
    if (search.trim()) {
      const q = search.toUpperCase();
      result = result.filter(
        (b) =>
          b.isin_code.toUpperCase().includes(q) ||
          (b.issuer && b.issuer.toUpperCase().includes(q)),
      );
    }
    if (currencyFilter) {
      result = result.filter((b) => b.currency === currencyFilter);
    }
    if (typeFilter) {
      result = result.filter((b) => b.security_type && b.security_type.includes(typeFilter));
    }
    return result;
  }, [bonds, search, currencyFilter, typeFilter]);

  const securityTypes = useMemo(() => {
    const types = new Set<string>();
    bonds.forEach((b) => {
      if (b.security_type) types.add(b.security_type);
    });
    return Array.from(types).sort();
  }, [bonds]);

  const currencies = useMemo(() => {
    const curs = new Set<string>();
    bonds.forEach((b) => curs.add(b.currency));
    return Array.from(curs).sort();
  }, [bonds]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display text-display-md text-foreground">Tahviller</h1>
          <p className="text-data-sm text-muted-foreground mt-1">
            BIST Borçlanma Araçları — {formatDecimal(total, 0)} aktif kayıt
          </p>
        </div>
      </div>

      {loading && (
        <div className="grid gap-px md:grid-cols-4 bg-border/30 rounded-lg overflow-hidden animate-fade-up">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card p-5 grain">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      )}
      {stats && !loading && (
        <div className="grid gap-px md:grid-cols-4 bg-border/30 rounded-lg overflow-hidden animate-fade-up">
          <div className="bg-card p-5 grain">
            <div className="text-label text-muted-foreground mb-2">TOPLAM TAHVIL</div>
            <div className="font-mono-data text-stat text-primary">
              {formatDecimal(stats.total_bonds, 0)}
            </div>
            <div className="text-label text-muted-foreground/60 mt-1">Aktif kayit</div>
          </div>
          <div className="bg-card p-5 grain">
            <div className="text-label text-muted-foreground mb-2">ORT. VADE</div>
            <div className="font-mono-data text-stat text-foreground">
              {stats.avg_days_to_maturity != null
                ? `${Math.round(stats.avg_days_to_maturity)} gün`
                : "—"}
            </div>
            <div className="text-label text-muted-foreground/60 mt-1">Kalan gün</div>
          </div>
          <div className="bg-card p-5 grain">
            <div className="text-label text-muted-foreground mb-2">PARA BIRIMI</div>
            <div className="font-mono-data text-stat text-foreground">
              {Object.keys(stats.by_currency).length}
            </div>
            <div className="text-label text-muted-foreground/60 mt-1">
              {Object.entries(stats.by_currency)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")}
            </div>
          </div>
          <div className="bg-card p-5 grain">
            <div className="text-label text-muted-foreground mb-2">MK TURU</div>
            <div className="font-mono-data text-stat text-foreground">
              {Object.keys(stats.by_security_type).length}
            </div>
            <div className="text-label text-muted-foreground/60 mt-1">Farklı tür</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 animate-fade-up-delay-1">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="ISIN veya ihraççıyla ara..."
            className="font-mono-data"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-border bg-card px-3 py-2 text-data-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          value={currencyFilter}
          onChange={(e) => setCurrencyFilter(e.target.value)}
        >
          <option value="">Tüm Para Birimleri</option>
          {currencies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-card px-3 py-2 text-data-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[280px]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">Tüm MK Türleri</option>
          {securityTypes.map((t) => (
            <option key={t} value={t}>
              {t.length > 40 ? t.substring(0, 40) + "…" : t}
            </option>
          ))}
        </select>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>BORCLANMA ARACLARI</CardDescription>
              <CardTitle className="mt-1">Tahvil Listesi</CardTitle>
            </div>
            <span className="text-label text-muted-foreground">
              {search || currencyFilter || typeFilter
                ? `${filtered.length} / `
                : ""}
              {total} KAYIT
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    <th scope="col" className="pb-3 text-left text-label text-muted-foreground font-normal">
                      ISIN
                    </th>
                    <th scope="col" className="pb-3 text-left text-label text-muted-foreground font-normal">
                      IHRACÇI
                    </th>
                    <th scope="col" className="pb-3 text-left text-label text-muted-foreground font-normal">
                      TUR
                    </th>
                    <th scope="col" className="pb-3 text-left text-label text-muted-foreground font-normal">
                      GETIRI TURU
                    </th>
                    <th scope="col" className="pb-3 text-center text-label text-muted-foreground font-normal">
                      DOVIZ
                    </th>
                    <th scope="col" className="pb-3 text-right text-label text-muted-foreground font-normal">
                      VADE
                    </th>
                    <th scope="col" className="pb-3 text-right text-label text-muted-foreground font-normal">
                      SON FIYAT
                    </th>
                    <th scope="col" className="pb-3 text-right text-label text-muted-foreground font-normal">
                      GETIRI %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 18 }).map((_, i) => (
                    <tr
                      key={i}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="py-3"><Skeleton className="h-5 w-28" /></td>
                      <td className="py-3"><Skeleton className="h-5 w-40" /></td>
                      <td className="py-3"><Skeleton className="h-5 w-24" /></td>
                      <td className="py-3"><Skeleton className="h-5 w-20" /></td>
                      <td className="py-3 text-center"><Skeleton className="h-5 w-10 mx-auto" /></td>
                      <td className="py-3 text-right"><Skeleton className="h-5 w-16 ml-auto" /></td>
                      <td className="py-3 text-right"><Skeleton className="h-5 w-14 ml-auto" /></td>
                      <td className="py-3 text-right"><Skeleton className="h-5 w-12 ml-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {error && !loading && (
            <EmptyState
              variant="error"
              title="Veri yuklenemedi"
              description={error}
              icon={<AlertCircle className="h-7 w-7" />}
              action={{ label: "Yenile", onClick: () => window.location.reload() }}
            />
          )}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              title={
                search || currencyFilter || typeFilter
                  ? "Filtreyle eşleşen tahvil yok"
                  : "Henüz tahvil yok"
              }
              description={
                search || currencyFilter || typeFilter
                  ? "Arama veya filtreleri değiştirerek tekrar deneyin."
                  : "Admin panelden tahvil listesini güncelleyebilirsiniz."
              }
              icon={<Inbox className="h-7 w-7" />}
              action={
                search || currencyFilter || typeFilter
                  ? {
                      label: "Filtreleri temizle",
                      onClick: () => {
                        setSearch("");
                        setCurrencyFilter("");
                        setTypeFilter("");
                      },
                    }
                  : undefined
              }
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <>
              <div className="block md:hidden space-y-3 max-h-[600px] overflow-y-auto">
                {filtered.map((bond) => (
                  <Link
                    key={bond.isin_code}
                    href={`/dashboard/bonds/${bond.isin_code}`}
                    onClick={() => {
                      try {
                        sessionStorage.setItem(
                          "bondley_bonds_isins",
                          JSON.stringify(filtered.map((b) => b.isin_code))
                        );
                      } catch {
                        // ignore
                      }
                    }}
                    className="block rounded-xl border border-border bg-card p-4 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-data text-data-sm font-medium text-primary">
                        {bond.isin_code}
                      </span>
                      <Badge
                        variant={(CURRENCY_COLORS[bond.currency] as any) || "outline"}
                        className="shrink-0"
                      >
                        {bond.currency}
                      </Badge>
                    </div>
                    <p className="text-data-sm text-muted-foreground truncate mt-1">
                      {bond.issuer || "—"}
                    </p>
                    <div className="flex justify-between text-data-sm mt-2 text-muted-foreground">
                      <span>
                        Vade:{" "}
                        {bond.days_to_maturity != null
                          ? `${bond.days_to_maturity} gün`
                          : formatDate(bond.maturity_date)}
                      </span>
                      <span className="text-foreground font-mono-data">
                        {formatDecimal(bond.last_issue_price, 3)}
                      </span>
                    </div>
                    <div className="text-data-sm text-positive font-mono-data mt-1">
                      {bond.last_issue_yield != null ? formatPercent(bond.last_issue_yield) : "—"}
                    </div>
                  </Link>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    <th scope="col" className="pb-3 text-left text-label text-muted-foreground font-normal">
                      ISIN
                    </th>
                    <th scope="col" className="pb-3 text-left text-label text-muted-foreground font-normal">
                      IHRACÇI
                    </th>
                    <th scope="col" className="pb-3 text-left text-label text-muted-foreground font-normal">
                      TUR
                    </th>
                    <th scope="col" className="pb-3 text-left text-label text-muted-foreground font-normal">
                      GETIRI TURU
                    </th>
                    <th scope="col" className="pb-3 text-center text-label text-muted-foreground font-normal">
                      DOVIZ
                    </th>
                    <th scope="col" className="pb-3 text-right text-label text-muted-foreground font-normal">
                      VADE
                    </th>
                    <th scope="col" className="pb-3 text-right text-label text-muted-foreground font-normal">
                      SON FIYAT
                    </th>
                    <th scope="col" className="pb-3 text-right text-label text-muted-foreground font-normal">
                      GETIRI %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((bond) => (
                    <tr
                      key={bond.isin_code}
                      className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors group"
                    >
                      <td className="py-3">
                        <Link
                          href={`/dashboard/bonds/${bond.isin_code}`}
                          className="font-mono-data text-data-sm text-foreground group-hover:text-primary transition-colors"
                          onClick={() => {
                            try {
                              sessionStorage.setItem(
                                "bondley_bonds_isins",
                                JSON.stringify(filtered.map((b) => b.isin_code))
                              );
                            } catch {
                              // ignore
                            }
                          }}
                        >
                          {bond.isin_code}
                        </Link>
                      </td>
                      <td className="py-3 text-data-sm text-muted-foreground max-w-[200px] truncate">
                        {bond.issuer
                          ? bond.issuer.length > 35
                            ? bond.issuer.substring(0, 35) + "…"
                            : bond.issuer
                          : "—"}
                      </td>
                      <td className="py-3">
                        {bond.security_type ? (
                          <span className="text-data-sm text-muted-foreground">
                            {bond.security_type.split("/")[0].trim().length > 25
                              ? bond.security_type.split("/")[0].trim().substring(0, 25) + "…"
                              : bond.security_type.split("/")[0].trim()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3">
                        {bond.yield_type ? (
                          <span className="text-data-sm text-muted-foreground">
                            {bond.yield_type.split("/")[0].trim().length > 20
                              ? bond.yield_type.split("/")[0].trim().substring(0, 20) + "…"
                              : bond.yield_type.split("/")[0].trim()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <Badge
                          variant={
                            (CURRENCY_COLORS[bond.currency] as any) || "outline"
                          }
                        >
                          {bond.currency}
                        </Badge>
                      </td>
                      <td className="py-3 text-right font-mono-data text-data-sm text-muted-foreground">
                        {bond.days_to_maturity != null
                          ? `${bond.days_to_maturity} gün`
                          : formatDate(bond.maturity_date)}
                      </td>
                      <td className="py-3 text-right font-mono-data text-data-sm text-foreground">
                        {formatDecimal(bond.last_issue_price, 3)}
                      </td>
                      <td className="py-3 text-right font-mono-data text-data-sm text-positive">
                        {bond.last_issue_yield != null ? formatPercent(bond.last_issue_yield) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
