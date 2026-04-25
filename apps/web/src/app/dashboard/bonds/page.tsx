"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { AlertCircle, Inbox, Star, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api, BondListItem, BondStats, TLREFRecord } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDecimal, formatPercentFromDecimal, formatPercent, formatDate } from "@/lib/utils";
import { tr } from "@/locales/tr";
import { SwipeableCard } from "@/components/swipeable-card";

const CURRENCY_COLORS: Record<string, string> = {
  TRY: "default",
  USD: "secondary",
  EUR: "outline",
};

export default function BondsListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    document.title = `${tr.dashboard.bonds.title} — ${tr.common.brand}`;
    return () => {
      document.title = tr.common.brand;
    };
  }, []);
  const [bonds, setBonds] = useState<BondListItem[]>([]);
  const [recentBonds, setRecentBonds] = useState<BondListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<BondStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullListLoading, setFullListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [currencyFilter, setCurrencyFilter] = useState<string>(() => searchParams.get("currency") ?? "");
  const [typeFilter, setTypeFilter] = useState<string>(() => searchParams.get("type") ?? "");
  const [favoriteIsins, setFavoriteIsins] = useState<Set<string>>(new Set());
  const [favoriteToggling, setFavoriteToggling] = useState<string | null>(null);
  const [withDataOnly, setWithDataOnly] = useState(() => searchParams.get("data") !== "0");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (currencyFilter) params.set("currency", currencyFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (!withDataOnly) params.set("data", "0");
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [search, currencyFilter, typeFilter, withDataOnly]);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError(tr.dashboard.bonds.errors.loginRequired);
      setLoading(false);
      return;
    }

    Promise.all([
      api.bonds.list(token, { active_only: true, with_data_only: withDataOnly, limit: 10, order_by: "updated_at_desc" }),
      api.bonds.stats(token),
      api.bonds.favoritesList(token),
    ])
      .then(([recentRes, statsRes, favRes]) => {
        setRecentBonds(recentRes.items || []);
        setTotal(recentRes.total ?? 0);
        setStats(statsRes);
        setFavoriteIsins(new Set((favRes.items || []).map((b) => b.isin_code)));
        setLoading(false);

        setFullListLoading(true);
        api.bonds
          .list(token, { active_only: true, with_data_only: withDataOnly, limit: 3000 })
          .then((fullRes) => {
            setBonds(fullRes.items || []);
            setTotal(fullRes.total ?? 0);
          })
          .catch(() => { })
          .finally(() => setFullListLoading(false));
      })
      .catch((e) => {
        setError(e?.message || tr.dashboard.bonds.errors.loadFailed);
        setLoading(false);
      });
  }, [withDataOnly]);

  const toggleFavorite = (e: React.MouseEvent, isinCode: string) => {
    e.preventDefault();
    e.stopPropagation();
    const token = getToken();
    if (!token || favoriteToggling) return;
    const isFavorite = favoriteIsins.has(isinCode);
    setFavoriteToggling(isinCode);
    if (isFavorite) {
      api.bonds
        .removeFavorite(token, isinCode)
        .then(() => setFavoriteIsins((prev) => { const s = new Set(prev); s.delete(isinCode); return s; }))
        .catch(() => { })
        .finally(() => setFavoriteToggling(null));
    } else {
      api.bonds
        .addFavorite(token, isinCode)
        .then(() => setFavoriteIsins((prev) => new Set(prev).add(isinCode)))
        .catch(() => { })
        .finally(() => setFavoriteToggling(null));
    }
  };

  const swipeAddFavorite = (isinCode: string) => {
    const token = getToken();
    if (!token || favoriteToggling) return;
    setFavoriteToggling(isinCode);
    api.bonds
      .addFavorite(token, isinCode)
      .then(() => setFavoriteIsins((prev) => new Set(prev).add(isinCode)))
      .catch(() => { })
      .finally(() => setFavoriteToggling(null));
  };

  const swipeRemoveFavorite = (isinCode: string) => {
    const token = getToken();
    if (!token || favoriteToggling) return;
    setFavoriteToggling(isinCode);
    api.bonds
      .removeFavorite(token, isinCode)
      .then(() => setFavoriteIsins((prev) => { const s = new Set(prev); s.delete(isinCode); return s; }))
      .catch(() => { })
      .finally(() => setFavoriteToggling(null));
  };

  const activeBonds = bonds.length > 0 ? bonds : recentBonds;

  const filtered = useMemo(() => {
    let result = activeBonds;
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
  }, [activeBonds, search, currencyFilter, typeFilter]);

  const securityTypes = useMemo(() => {
    const types = new Set<string>();
    activeBonds.forEach((b) => {
      if (b.security_type) types.add(b.security_type);
    });
    return Array.from(types).sort();
  }, [activeBonds]);

  const currencies = useMemo(() => {
    const curs = new Set<string>();
    activeBonds.forEach((b) => curs.add(b.currency));
    return Array.from(curs).sort();
  }, [activeBonds]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-display-md text-foreground">{tr.dashboard.bonds.title}</h1>
          <p className="text-[15px] text-muted-foreground mt-1.5">
            {withDataOnly && stats
              ? tr.dashboard.bonds.description
                  .replace("{total}", formatDecimal(stats.total_bonds, 0))
                  .replace("{count}", formatDecimal(total, 0))
              : tr.dashboard.bonds.descriptionFull.replace("{total}", formatDecimal(total, 0))}
          </p>
        </div>
      </div>

      {/* Stats */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-4 animate-fade-up">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card rounded-3xl border border-border p-5">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      )}
      {stats && !loading && (
        <div className="grid gap-4 md:grid-cols-4 animate-fade-up">
          <div className="bg-card rounded-3xl border border-border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[13px] font-medium text-muted-foreground mb-2">{tr.dashboard.bonds.stats.total}</div>
            <div className="font-mono-data text-stat text-primary">
              {formatDecimal(stats.total_bonds, 0)}
            </div>
            <div className="text-[13px] text-muted-foreground mt-1.5">{tr.dashboard.bonds.stats.totalDesc}</div>
          </div>
          <div className="bg-card rounded-3xl border border-border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[13px] font-medium text-muted-foreground mb-2">{tr.dashboard.bonds.stats.avgMaturity}</div>
            <div className="font-mono-data text-stat text-foreground">
              {stats.avg_days_to_maturity != null
                ? `${Math.round(stats.avg_days_to_maturity)} gün`
                : "—"}
            </div>
            <div className="text-[13px] text-muted-foreground mt-1.5">{tr.dashboard.bonds.stats.avgMaturityDesc}</div>
          </div>
          <div className="bg-card rounded-3xl border border-border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[13px] font-medium text-muted-foreground mb-2">{tr.dashboard.bonds.stats.currency}</div>
            <div className="font-mono-data text-stat text-foreground">
              {Object.keys(stats.by_currency).length}
            </div>
            <div className="text-[13px] text-muted-foreground mt-1.5">
              {tr.dashboard.bonds.stats.currencyDesc.replace("{count}", Object.keys(stats.by_currency).length.toString())}
            </div>
          </div>
          <div className="bg-card rounded-3xl border border-border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[13px] font-medium text-muted-foreground mb-2">{tr.dashboard.bonds.stats.securityType}</div>
            <div className="font-mono-data text-stat text-foreground">
              {Object.keys(stats.by_security_type).length}
            </div>
            <div className="text-[13px] text-muted-foreground mt-1.5">
              {tr.dashboard.bonds.stats.securityTypeDesc.replace("{count}", Object.keys(stats.by_security_type).length.toString())}
            </div>
          </div>
        </div>
      )}



      {/* Recent Bonds */}
      {!loading && recentBonds.length > 0 && (
        <Card className="animate-fade-up-delay-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>{tr.dashboard.bonds.recent.title}</CardDescription>
                <CardTitle className="mt-1">{tr.dashboard.bonds.recent.subtitle}</CardTitle>
              </div>
              {fullListLoading && (
                <span className="text-[13px] text-muted-foreground animate-pulse">
                  {tr.dashboard.bonds.recent.loadingFull}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recentBonds.map((b) => (
                <Link
                  key={b.isin_code}
                  href={`/dashboard/bonds/${encodeURIComponent(b.isin_code)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/50 px-3 py-1.5 text-[13px] text-foreground hover:bg-secondary transition-colors"
                >
                  <span className="font-mono-data font-medium">{b.isin_code}</span>
                  {b.issuer && (
                    <span className="text-muted-foreground truncate max-w-[240px]">{b.issuer}</span>
                  )}
                  <Badge variant={(CURRENCY_COLORS[b.currency] as any) || "outline"} className="text-[10px]">
                    {b.currency}
                  </Badge>
                  {b.last_issue_yield != null && (
                    <span className="font-mono-data text-primary text-[11px]">
                      {formatPercent(b.last_issue_yield)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filters */}
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

        <div className="flex items-center gap-2 px-3 py-1 bg-secondary/30 rounded-xl border border-border/50">
          <Switch
            id="with-data-toggle"
            checked={withDataOnly}
            onCheckedChange={setWithDataOnly}
          />
          <Label htmlFor="with-data-toggle" className="text-[13px] font-medium cursor-pointer select-none">
            {tr.dashboard.bonds.filters.withDataOnly}
          </Label>
        </div>
      </div>

      {/* Bonds Table */}
      <Card className="animate-fade-up-delay-1 overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>{tr.dashboard.bonds.table.subtitle}</CardDescription>
              <CardTitle className="mt-1">{tr.dashboard.bonds.table.title}</CardTitle>
            </div>
            <span className="text-[13px] font-medium text-muted-foreground">
              {fullListLoading
                ? tr.dashboard.bonds.table.loadingCount.replace("{count}", total.toString())
                : search || currencyFilter || typeFilter
                  ? tr.dashboard.bonds.table.filteredCount.replace("{count}", filtered.length.toString()).replace("{total}", total.toString())
                  : tr.dashboard.bonds.table.count.replace("{count}", total.toString())
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
                  {Array.from({ length: 18 }).map((_, i) => (
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
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              title={
                search || currencyFilter || typeFilter
                  ? tr.dashboard.bonds.empty.noMatches
                  : tr.dashboard.bonds.empty.noBonds
              }
              description={
                search || currencyFilter || typeFilter
                  ? tr.dashboard.bonds.empty.noMatchesDesc
                  : tr.dashboard.bonds.empty.noBondsDesc
              }
              icon={<Inbox className="h-7 w-7" />}
              action={
                search || currencyFilter || typeFilter
                  ? {
                    label: tr.dashboard.bonds.empty.clearFilters,
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
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3 max-h-[600px] overflow-y-auto">
                {filtered.map((bond) => (
                  <SwipeableCard
                    key={bond.isin_code}
                    onSwipeRight={!favoriteIsins.has(bond.isin_code) ? () => swipeAddFavorite(bond.isin_code) : undefined}
                    onSwipeLeft={favoriteIsins.has(bond.isin_code) ? () => swipeRemoveFavorite(bond.isin_code) : undefined}
                    rightLabel={tr.dashboard.bondDetails.actions.addFavorite}
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
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => toggleFavorite(e, bond.isin_code)}
                          disabled={favoriteToggling === bond.isin_code}
                          aria-label={favoriteIsins.has(bond.isin_code) ? tr.dashboard.bonds.table.cols.favorite : tr.dashboard.bonds.table.cols.favorite}
                        >
                          <Star
                            className={`h-4 w-4 ${favoriteIsins.has(bond.isin_code) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                          />
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
              <div ref={tableContainerRef} className="hidden md:block overflow-x-auto max-h-[70vh] overflow-y-auto">
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
                    {paddingTop > 0 && (
                      <tr><td colSpan={9} style={{ height: paddingTop }} /></tr>
                    )}
                    {virtualRows.map((virtualRow) => {
                      const bond = filtered[virtualRow.index];
                      return (
                      <tr
                        key={bond.isin_code}
                        className="border-b border-border/30 last:border-0 hover:bg-secondary/40 transition-colors group"
                      >
                        <td className="py-3.5 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => toggleFavorite(e, bond.isin_code)}
                            disabled={favoriteToggling === bond.isin_code}
                            aria-label={favoriteIsins.has(bond.isin_code) ? tr.dashboard.bonds.table.cols.favorite : tr.dashboard.bonds.table.cols.favorite}
                          >
                            <Star
                              className={`h-4 w-4 ${favoriteIsins.has(bond.isin_code) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                            />
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
                      );
                    })}
                    {paddingBottom > 0 && (
                      <tr><td colSpan={9} style={{ height: paddingBottom }} /></tr>
                    )}
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
