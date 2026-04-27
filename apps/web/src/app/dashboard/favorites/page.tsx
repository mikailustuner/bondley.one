"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { AlertCircle, Star, Search, ArchiveX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, BondListItem } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDecimal, formatPercent, formatDate } from "@/lib/utils";
import { tr } from "@/locales/tr";
import { SwipeableCard } from "@/components/swipeable-card";

const CURRENCY_COLORS: Record<string, string> = {
  TRY: "default",
  USD: "secondary",
  EUR: "outline",
};

export default function FavoritesPage() {
  useEffect(() => {
    document.title = `${tr.dashboard.favorites.title} — ${tr.common.brand}`;
    return () => {
      document.title = tr.common.brand;
    };
  }, []);

  const [bonds, setBonds] = useState<BondListItem[]>([]);
  const [archivedBonds, setArchivedBonds] = useState<BondListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  // To handle local unfavoriting easily
  const [favoriteToggling, setFavoriteToggling] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError(tr.dashboard.bonds.errors.loginRequired);
      setLoading(false);
      return;
    }

    Promise.all([
      api.bonds.favoritesList(token),
      api.bonds.favoritesArchived(token),
    ])
      .then(([active, archived]) => {
        setBonds(active.items || []);
        setArchivedBonds(archived.items || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.message || tr.dashboard.bonds.errors.loadFailed);
        setLoading(false);
      });
  }, []);

  const removeFavorite = (e: React.MouseEvent, isinCode: string) => {
    e.preventDefault();
    e.stopPropagation();
    const token = getToken();
    if (!token || favoriteToggling) return;

    setFavoriteToggling(isinCode);
    api.bonds
      .removeFavorite(token, isinCode)
      .then(() => {
        setBonds((prev) => prev.filter((b) => b.isin_code !== isinCode));
        setArchivedBonds((prev) => prev.filter((b) => b.isin_code !== isinCode));
      })
      .catch(() => { })
      .finally(() => setFavoriteToggling(null));
  };

  const removeFavoriteByIsin = (isinCode: string) => {
    const token = getToken();
    if (!token || favoriteToggling) return;
    setFavoriteToggling(isinCode);
    api.bonds
      .removeFavorite(token, isinCode)
      .then(() => {
        setBonds((prev) => prev.filter((b) => b.isin_code !== isinCode));
        setArchivedBonds((prev) => prev.filter((b) => b.isin_code !== isinCode));
      })
      .catch(() => { })
      .finally(() => setFavoriteToggling(null));
  };

  const maturityBuckets = useMemo(() => {
    const today = new Date();
    const counts = [0, 0, 0, 0, 0, 0, 0];
    bonds.forEach((b) => {
      let days = b.days_to_maturity;
      if (days == null && b.maturity_date) {
        days = Math.ceil((new Date(b.maturity_date).getTime() - today.getTime()) / 86400000);
      }
      if (days == null || days < 0) return;
      if (days <= 30) counts[0]++;
      else if (days <= 90) counts[1]++;
      else if (days <= 180) counts[2]++;
      else if (days <= 365) counts[3]++;
      else if (days <= 730) counts[4]++;
      else if (days <= 1095) counts[5]++;
      else counts[6]++;
    });
    return counts;
  }, [bonds]);

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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-display-md text-foreground">{tr.dashboard.favorites.title}</h1>
          <p className="text-[15px] text-muted-foreground mt-1.5">
            {tr.dashboard.favorites.description}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      {bonds.length > 0 && (
        <div className="flex flex-wrap gap-3 animate-fade-up-delay-1">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] pointer-events-none text-muted-foreground/70" />
            <Input
              placeholder={tr.dashboard.bonds.filters.searchPlaceholder}
              className="pl-11 h-12 rounded-full bg-background border-border shadow-md hover:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary text-[15px] transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-11 rounded-xl border border-border bg-card px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
          >
            <option value="">{tr.dashboard.bonds.filters.allCurrencies}</option>
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="h-11 rounded-xl border border-border bg-card px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all max-w-[280px]"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">{tr.dashboard.bonds.filters.allTypes}</option>
            {securityTypes.map((t) => (
              <option key={t} value={t}>
                {t.length > 40 ? t.substring(0, 40) + "…" : t}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Maturity Ladder */}
      {!loading && bonds.length > 0 && (
        <Card className="animate-fade-up-delay-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{tr.dashboard.favorites.maturityLadder.title}</CardTitle>
            <CardDescription>{tr.dashboard.favorites.maturityLadder.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-16">
              {maturityBuckets.map((count, i) => {
                const maxCount = Math.max(...maturityBuckets, 1);
                const barH = count > 0 ? Math.max((count / maxCount) * 100, 6) : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end">
                    {count > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono-data mb-0.5">{count}</span>
                    )}
                    <div
                      className="w-full rounded-t-sm bg-primary/70 transition-all"
                      style={{ height: `${barH}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1.5 mt-1.5">
              {tr.dashboard.favorites.maturityLadder.buckets.map((label, i) => (
                <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground truncate">
                  {label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bonds Table */}
      <Card className="animate-fade-up-delay-1 overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>{tr.dashboard.bonds.table.subtitle}</CardDescription>
              <CardTitle className="mt-1">{tr.dashboard.favorites.title}</CardTitle>
            </div>
            <span className="text-[13px] font-medium text-muted-foreground">
              {loading
                ? tr.common.loading
                : search || currencyFilter || typeFilter
                  ? tr.dashboard.bonds.table.filteredCount.replace("{count}", filtered.length.toString()).replace("{total}", bonds.length.toString())
                  : tr.dashboard.bonds.table.count.replace("{count}", bonds.length.toString())
              }
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border">
                    <th scope="col" className="w-10 pb-3" />
                    <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.isin}</th>
                    <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.issuer}</th>
                    <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.type}</th>
                    <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.yieldType}</th>
                    <th scope="col" className="pb-3 text-center text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.currency}</th>
                    <th scope="col" className="pb-3 text-right text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.maturity}</th>
                    <th scope="col" className="pb-3 text-right text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.lastPrice}</th>
                    <th scope="col" className="pb-3 text-right text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.yield}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-0">
                      <td className="py-3.5 w-10 text-center"><Skeleton className="h-5 w-5 mx-auto" /></td>
                      <td className="py-3.5"><Skeleton className="h-5 w-28" /></td>
                      <td className="py-3.5"><Skeleton className="h-5 w-40" /></td>
                      <td className="py-3.5"><Skeleton className="h-5 w-24" /></td>
                      <td className="py-3.5"><Skeleton className="h-5 w-20" /></td>
                      <td className="py-3.5 text-center"><Skeleton className="h-5 w-10 mx-auto" /></td>
                      <td className="py-3.5 text-right"><Skeleton className="h-5 w-16 ml-auto" /></td>
                      <td className="py-3.5 text-right"><Skeleton className="h-5 w-14 ml-auto" /></td>
                      <td className="py-3.5 text-right"><Skeleton className="h-5 w-12 ml-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {error && !loading && (
            <EmptyState
              variant="error"
              title={tr.dashboard.bonds.errors.loadFailed}
              description={error}
              icon={<AlertCircle className="h-7 w-7" />}
              action={{ label: tr.dashboard.bonds.empty.refresh, onClick: () => window.location.reload() }}
            />
          )}
          {!loading && !error && bonds.length === 0 && (
            <EmptyState
              title={tr.dashboard.favorites.empty.noBonds}
              description={tr.dashboard.favorites.empty.noBondsDesc}
              icon={<Star className="h-7 w-7" />}
              action={{
                label: tr.dashboard.favorites.empty.goBonds,
                onClick: () => window.location.href = "/dashboard/bonds",
              }}
            />
          )}
          {!loading && !error && bonds.length > 0 && filtered.length === 0 && (
            <EmptyState
              title={tr.dashboard.favorites.empty.noMatches}
              description={tr.dashboard.favorites.empty.noMatchesDesc}
              icon={<Star className="h-7 w-7" />}
              action={{
                label: tr.dashboard.favorites.empty.clearFilters,
                onClick: () => {
                  setSearch("");
                  setCurrencyFilter("");
                  setTypeFilter("");
                },
              }}
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3 max-h-[600px] overflow-y-auto">
                {filtered.map((bond) => (
                  <SwipeableCard
                    key={bond.isin_code}
                    onSwipeLeft={() => removeFavoriteByIsin(bond.isin_code)}
                    leftLabel={tr.dashboard.bondDetails.actions.removeFavorite}
                  >
                    <Link
                      href={`/dashboard/bonds/${bond.isin_code}`}
                      onClick={() => {
                        try {
                          sessionStorage.setItem(
                            "bondley_bonds_isins",
                            JSON.stringify(filtered.map((b) => b.isin_code))
                          );
                        } catch { }
                      }}
                      className="block rounded-3xl border border-border bg-card p-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-data text-[13px] font-medium text-primary">
                          {bond.isin_code}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={(e) => removeFavorite(e, bond.isin_code)}
                            disabled={favoriteToggling === bond.isin_code}
                            aria-label={tr.dashboard.bonds.table.cols.favorite}
                          >
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          </Button>
                          <Badge
                            variant={(CURRENCY_COLORS[bond.currency] as any) || "outline"}
                            className="shrink-0"
                          >
                            {bond.currency}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-[13px] text-muted-foreground truncate mt-1">
                        {bond.issuer || "—"}
                      </p>
                      {bond.fund_user && (
                        <p className="text-[11px] text-muted-foreground/70 truncate flex items-center gap-1 mt-0.5">
                          <span className="shrink-0 text-primary/40">↳</span>
                          {bond.fund_user}
                        </p>
                      )}
                      <div className="flex justify-between text-[13px] mt-2.5 text-muted-foreground">
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
                      <div className="text-[13px] text-positive font-mono-data mt-1">
                        {bond.last_issue_yield != null ? formatPercent(bond.last_issue_yield) : "—"}
                      </div>
                    </Link>
                  </SwipeableCard>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border">
                      <th scope="col" className="w-10 text-center pb-3 text-[13px] font-medium text-muted-foreground">
                        <span className="sr-only">{tr.dashboard.bonds.table.cols.favorite}</span>
                      </th>
                      <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.isin}</th>
                      <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.issuer}</th>
                      <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.type}</th>
                      <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.yieldType}</th>
                      <th scope="col" className="pb-3 text-center text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.currency}</th>
                      <th scope="col" className="pb-3 text-right text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.maturity}</th>
                      <th scope="col" className="pb-3 text-right text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.lastPrice}</th>
                      <th scope="col" className="pb-3 text-right text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.yield}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((bond) => (
                      <tr
                        key={bond.isin_code}
                        className="border-b border-border/30 last:border-0 hover:bg-secondary/40 transition-colors group"
                      >
                        <td className="py-3.5 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => removeFavorite(e, bond.isin_code)}
                            disabled={favoriteToggling === bond.isin_code}
                            aria-label={tr.dashboard.bonds.table.cols.favorite}
                          >
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          </Button>
                        </td>
                        <td className="py-3.5">
                          <Link
                            href={`/dashboard/bonds/${bond.isin_code}`}
                            className="font-mono-data text-[13px] text-foreground group-hover:text-primary transition-colors"
                            onClick={() => {
                              try {
                                sessionStorage.setItem(
                                  "bondley_bonds_isins",
                                  JSON.stringify(filtered.map((b) => b.isin_code))
                                );
                              } catch { }
                            }}
                          >
                            {bond.isin_code}
                          </Link>
                        </td>
                        <td className="py-3.5 text-[13px] text-muted-foreground max-w-[400px] truncate">
                          <div className="truncate" title={bond.issuer ?? ""}>
                            {bond.issuer ?? "—"}
                          </div>
                          {bond.fund_user && (
                            <div className="truncate text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5" title={bond.fund_user}>
                              <span className="shrink-0 text-primary/40">↳</span>
                              {bond.fund_user}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5">
                          {bond.security_type ? (
                            <span className="text-[13px] text-muted-foreground">
                              {bond.security_type.split("/")[0].trim()}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3.5">
                          {bond.yield_type ? (
                            <span className="text-[13px] text-muted-foreground">
                              {bond.yield_type.split("/")[0].trim()}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3.5 text-center">
                          <Badge
                            variant={
                              (CURRENCY_COLORS[bond.currency] as any) || "outline"
                            }
                          >
                            {bond.currency}
                          </Badge>
                        </td>
                        <td className="py-3.5 text-right font-mono-data text-[13px] text-muted-foreground">
                          {bond.days_to_maturity != null
                            ? `${bond.days_to_maturity} gün`
                            : formatDate(bond.maturity_date)}
                        </td>
                        <td className="py-3.5 text-right font-mono-data text-[13px] text-foreground">
                          {formatDecimal(bond.last_issue_price, 3)}
                        </td>
                        <td className="py-3.5 text-right font-mono-data text-[13px] text-positive">
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

      {/* Archived / Expired Favorites */}
      {!loading && archivedBonds.length > 0 && (
        <Card className="animate-fade-up-delay-1 overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <ArchiveX className="h-4 w-4 text-muted-foreground" />
              <div>
                <CardDescription>{tr.dashboard.favorites.archived.description}</CardDescription>
                <CardTitle className="mt-1">{tr.dashboard.favorites.archived.title}</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mobile Cards */}
            <div className="block md:hidden space-y-3 max-h-[400px] overflow-y-auto">
              {archivedBonds.map((bond) => (
                <Link
                  key={bond.isin_code}
                  href={`/dashboard/bonds/${bond.isin_code}`}
                  className="block rounded-3xl border border-border bg-card p-4 opacity-60 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-data text-[13px] font-medium text-foreground">
                      {bond.isin_code}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={(e) => removeFavorite(e, bond.isin_code)}
                        disabled={favoriteToggling === bond.isin_code}
                        aria-label={tr.dashboard.bonds.table.cols.favorite}
                      >
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </Button>
                      <Badge
                        variant={(CURRENCY_COLORS[bond.currency] as any) || "outline"}
                        className="shrink-0"
                      >
                        {bond.currency}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[13px] text-muted-foreground truncate mt-1">
                    {bond.issuer || "—"}
                  </p>
                  <div className="flex justify-between text-[13px] mt-2.5 text-muted-foreground">
                    <span>Vade: {formatDate(bond.maturity_date)}</span>
                    <span className="font-mono-data">{formatDecimal(bond.last_issue_price, 3)}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border">
                    <th scope="col" className="w-10 text-center pb-3 text-[13px] font-medium text-muted-foreground">
                      <span className="sr-only">{tr.dashboard.bonds.table.cols.favorite}</span>
                    </th>
                    <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.isin}</th>
                    <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.issuer}</th>
                    <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.type}</th>
                    <th scope="col" className="pb-3 text-left text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.yieldType}</th>
                    <th scope="col" className="pb-3 text-center text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.currency}</th>
                    <th scope="col" className="pb-3 text-right text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.maturity}</th>
                    <th scope="col" className="pb-3 text-right text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.lastPrice}</th>
                    <th scope="col" className="pb-3 text-right text-[13px] font-medium text-muted-foreground">{tr.dashboard.bonds.table.cols.yield}</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedBonds.map((bond) => (
                    <tr
                      key={bond.isin_code}
                      className="border-b border-border/30 last:border-0 hover:bg-secondary/40 transition-colors group opacity-60 hover:opacity-80"
                    >
                      <td className="py-3.5 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => removeFavorite(e, bond.isin_code)}
                          disabled={favoriteToggling === bond.isin_code}
                          aria-label={tr.dashboard.bonds.table.cols.favorite}
                        >
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        </Button>
                      </td>
                      <td className="py-3.5">
                        <Link
                          href={`/dashboard/bonds/${bond.isin_code}`}
                          className="font-mono-data text-[13px] text-foreground group-hover:text-primary transition-colors"
                        >
                          {bond.isin_code}
                        </Link>
                      </td>
                      <td className="py-3.5 text-[13px] text-muted-foreground max-w-[400px] truncate">
                        <div className="truncate" title={bond.issuer ?? ""}>{bond.issuer ?? "—"}</div>
                        {bond.fund_user && (
                          <div className="truncate text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5" title={bond.fund_user}>
                            <span className="shrink-0 text-primary/40">↳</span>
                            {bond.fund_user}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5">
                        {bond.security_type ? (
                          <span className="text-[13px] text-muted-foreground">{bond.security_type.split("/")[0].trim()}</span>
                        ) : "—"}
                      </td>
                      <td className="py-3.5">
                        {bond.yield_type ? (
                          <span className="text-[13px] text-muted-foreground">{bond.yield_type.split("/")[0].trim()}</span>
                        ) : "—"}
                      </td>
                      <td className="py-3.5 text-center">
                        <Badge variant={(CURRENCY_COLORS[bond.currency] as any) || "outline"}>
                          {bond.currency}
                        </Badge>
                      </td>
                      <td className="py-3.5 text-right font-mono-data text-[13px] text-muted-foreground">
                        {formatDate(bond.maturity_date)}
                      </td>
                      <td className="py-3.5 text-right font-mono-data text-[13px] text-foreground">
                        {formatDecimal(bond.last_issue_price, 3)}
                      </td>
                      <td className="py-3.5 text-right font-mono-data text-[13px] text-muted-foreground">
                        {bond.last_issue_yield != null ? formatPercent(bond.last_issue_yield) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
