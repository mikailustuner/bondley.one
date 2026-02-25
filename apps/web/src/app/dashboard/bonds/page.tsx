"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { AlertCircle, Inbox, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, BondListItem, BondStats } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDecimal, formatPercentFromDecimal, formatPercent, formatDate } from "@/lib/utils";
import { useProMode } from "@/components/pro-mode-provider";

const CURRENCY_COLORS: Record<string, string> = {
  TRY: "default",
  USD: "secondary",
  EUR: "outline",
};

export default function BondsListPage() {
  useEffect(() => {
    document.title = "Borçlanma Araçları — Bondley";
    return () => {
      document.title = "Bondley";
    };
  }, []);
  const { isPro } = useProMode();
  const [bonds, setBonds] = useState<BondListItem[]>([]);
  const [recentBonds, setRecentBonds] = useState<BondListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<BondStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullListLoading, setFullListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [favoriteIsins, setFavoriteIsins] = useState<Set<string>>(new Set());
  const [favoriteToggling, setFavoriteToggling] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Giriş yapmanız gerekiyor");
      setLoading(false);
      return;
    }

    // Faz 1: Son güncellenen 10 ihraç + stats + favoriler (hızlı)
    Promise.all([
      api.bonds.list(token, { active_only: true, limit: 10, order_by: "updated_at_desc" }),
      api.bonds.stats(token),
      api.bonds.favoritesList(token),
    ])
      .then(([recentRes, statsRes, favRes]) => {
        setRecentBonds(recentRes.items || []);
        setTotal(recentRes.total ?? 0);
        setStats(statsRes);
        setFavoriteIsins(new Set((favRes.items || []).map((b) => b.isin_code)));
        setLoading(false);

        // Faz 2: Tam liste arka planda yüklenir
        setFullListLoading(true);
        api.bonds
          .list(token, { active_only: true, limit: 3000 })
          .then((fullRes) => {
            setBonds(fullRes.items || []);
            setTotal(fullRes.total ?? 0);
          })
          .catch(() => {
            // Faz 2 başarısız olursa recent bonds ile devam et
          })
          .finally(() => setFullListLoading(false));
      })
      .catch((e) => {
        setError(e?.message || "Veri yuklenemedi");
        setLoading(false);
      });
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display text-display-md text-foreground">Borçlanma Araçları</h1>
          <p className="text-data-sm text-muted-foreground mt-1">
            Tahvil, Bono, Kira Sertifikası, VDMK ve türevleri — {formatDecimal(total, 0)} aktif kayıt
          </p>
        </div>
      </div>

      {loading && (
        <div className={`grid gap-px md:grid-cols-4 bg-border/30 overflow-hidden animate-fade-up ${isPro ? "rounded-none" : "rounded-lg"}`}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`bg-card ${isPro ? "p-3" : "p-5 grain"}`}>
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      )}
      {stats && !loading && (
        <div className={`grid gap-px md:grid-cols-4 bg-border/30 overflow-hidden animate-fade-up ${isPro ? "rounded-none border border-primary/30" : "rounded-lg"}`}>
          <div className={`bg-card ${isPro ? "px-4 py-3" : "p-5 grain"}`}>
            <div className={`text-label mb-2 ${isPro ? "text-primary" : "text-muted-foreground"}`}>TOPLAM MK</div>
            <div className="font-mono-data text-stat text-primary">
              {formatDecimal(stats.total_bonds, 0)}
            </div>
            {!isPro && <div className="text-label text-muted-foreground mt-1">Aktif kayit</div>}
          </div>
          <div className={`bg-card ${isPro ? "px-4 py-3" : "p-5 grain"}`}>
            <div className={`text-label mb-2 ${isPro ? "text-primary" : "text-muted-foreground"}`}>ORT. VADE</div>
            <div className={`font-mono-data text-stat ${isPro ? "text-primary" : "text-foreground"}`}>
              {stats.avg_days_to_maturity != null
                ? `${Math.round(stats.avg_days_to_maturity)} gün`
                : "—"}
            </div>
            {!isPro && <div className="text-label text-muted-foreground mt-1">Kalan gün</div>}
          </div>
          <div className={`bg-card ${isPro ? "px-4 py-3" : "p-5 grain"}`}>
            <div className={`text-label mb-2 ${isPro ? "text-primary" : "text-muted-foreground"}`}>PARA BIRIMI</div>
            <div className={`font-mono-data text-stat ${isPro ? "text-primary" : "text-foreground"}`}>
              {Object.keys(stats.by_currency).length}
            </div>
            <div className={`text-label mt-1 ${isPro ? "text-primary/70" : "text-muted-foreground"}`}>
              {Object.entries(stats.by_currency)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")}
            </div>
          </div>
          <div className={`bg-card ${isPro ? "px-4 py-3" : "p-5 grain"}`}>
            <div className={`text-label mb-2 ${isPro ? "text-primary" : "text-muted-foreground"}`}>MK TURU</div>
            <div className={`font-mono-data text-stat ${isPro ? "text-primary" : "text-foreground"}`}>
              {Object.keys(stats.by_security_type).length}
            </div>
            {!isPro && <div className="text-label text-muted-foreground mt-1">Farklı tür</div>}
          </div>
        </div>
      )}

      {!loading && recentBonds.length > 0 && (
        <Card className={`animate-fade-up-delay-1 ${isPro ? "rounded-none border-primary/30 p-2" : ""}`}>
          <CardHeader className={isPro ? "pb-2 pt-1 px-2" : "pb-3"}>
            <div className="flex items-center justify-between">
              <div>
                {!isPro && <CardDescription>SON GÜNCELLENEN</CardDescription>}
                <CardTitle className={isPro ? "text-sm text-primary font-mono" : "mt-1"}>
                  {isPro ? "[SON GUNCELLEMELER]" : "Son Güncellenen İhraçlar"}
                </CardTitle>
              </div>
              {fullListLoading && (
                <span className={`text-label animate-pulse ${isPro ? "text-primary" : "text-muted-foreground"}`}>
                  {isPro ? "LISTE_YUKLENIYOR..." : "Tam liste yükleniyor…"}
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
                  className="inline-flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-1.5 text-data-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <span className="font-mono-data font-medium">{b.isin_code}</span>
                  {b.issuer && (
                    <span className="text-muted-foreground truncate max-w-[120px]">{b.issuer}</span>
                  )}
                  <Badge variant={(CURRENCY_COLORS[b.currency] as any) || "outline"} className="text-xs">
                    {b.currency}
                  </Badge>
                  {b.last_issue_yield != null && (
                    <span className="font-mono-data text-primary text-xs">
                      {formatPercent(b.last_issue_yield)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className={`flex flex-wrap gap-3 animate-fade-up-delay-1 ${isPro ? "font-mono text-xs" : ""}`}>
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder={isPro ? "> ISIN VEYA IHRACCI GIRIN..." : "ISIN veya ihraççıyla ara..."}
            className={`font-mono-data ${isPro ? "rounded-none border-primary/50 focus-visible:ring-primary h-9 bg-black" : ""}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={`border bg-card px-3 py-2 text-data-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${isPro ? "rounded-none border-primary/50 h-9 bg-black uppercase text-xs" : "rounded-md border-border"}`}
          value={currencyFilter}
          onChange={(e) => setCurrencyFilter(e.target.value)}
        >
          <option value="">{isPro ? "TUM DOVIZLER" : "Tüm Para Birimleri"}</option>
          {currencies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className={`border bg-card px-3 py-2 text-data-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[280px] ${isPro ? "rounded-none border-primary/50 h-9 bg-black uppercase text-xs" : "rounded-md border-border"}`}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">{isPro ? "TUM MK TURLERI" : "Tüm MK Türleri"}</option>
          {securityTypes.map((t) => (
            <option key={t} value={t}>
              {t.length > 40 ? t.substring(0, 40) + "…" : t}
            </option>
          ))}
        </select>
      </div>

      <Card className={`animate-fade-up-delay-1 overflow-hidden ${isPro ? "rounded-none border-primary/50" : ""}`}>
        <CardHeader className={isPro ? "bg-primary/5 border-b border-primary/20 py-2 px-3" : ""}>
          <div className="flex items-center justify-between">
            <div>
              {!isPro && <CardDescription>BORCLANMA ARACLARI</CardDescription>}
              <CardTitle className={isPro ? "text-sm text-primary font-mono" : "mt-1"}>
                {isPro ? "[BORCLANMA_ARACLARI_VERITABANI]" : "Borçlanma Araçları Listesi"}
              </CardTitle>
            </div>
            <span className={`text-label ${isPro ? "text-primary" : "text-muted-foreground"}`}>
              {fullListLoading
                ? `${total} ${isPro ? "YUKLENIYOR..." : "kayıt yükleniyor…"}`
                : search || currencyFilter || typeFilter
                  ? `${filtered.length} / ${total} KAYIT`
                  : `${total} KAYIT`
              }
            </span>
          </div>
        </CardHeader>
        <CardContent className={isPro ? "p-0" : ""}>
          {loading && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className={`sticky top-0 z-10 ${isPro ? "bg-[#050505] border-b border-primary/40" : "bg-card"}`}>
                  <tr className={isPro ? "border-b border-primary/20" : "border-b border-border"}>
                    <th scope="col" className={`w-10 ${isPro ? "py-1.5" : "pb-3"}`} />
                    <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-left text-label font-normal`}>
                      ISIN
                    </th>
                    <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-left text-label font-normal`}>
                      IHRACÇI
                    </th>
                    <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-left text-label font-normal`}>
                      TUR
                    </th>
                    <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-left text-label font-normal`}>
                      GETIRI TURU
                    </th>
                    <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-center text-label font-normal`}>
                      DOVIZ
                    </th>
                    <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-right text-label font-normal`}>
                      VADE
                    </th>
                    <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-right text-label font-normal`}>
                      SON FIYAT
                    </th>
                    <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-right text-label font-normal`}>
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
                      <td className="py-3 w-10 text-center"><Skeleton className="h-5 w-5 mx-auto" /></td>
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
                  ? "Filtreyle eşleşen bor�lanma arac� yok"
                  : "Henüz bor�lanma arac� yok"
              }
              description={
                search || currencyFilter || typeFilter
                  ? "Arama veya filtreleri değiştirerek tekrar deneyin."
                  : "Admin panelden bor�lanma ara�lar� listesini güncelleyebilirsiniz."
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => toggleFavorite(e, bond.isin_code)}
                          disabled={favoriteToggling === bond.isin_code}
                          aria-label={favoriteIsins.has(bond.isin_code) ? "Favorilerden çıkar" : "Favorilere ekle"}
                        >
                          <Star
                            className={`h-4 w-4 ${favoriteIsins.has(bond.isin_code) ? "fill-primary text-primary" : "text-muted-foreground"}`}
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
              <div className="hidden md:block overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar">
                <table className="w-full">
                  <thead className={`sticky top-0 z-10 ${isPro ? "bg-[#050505] border-b border-primary/40" : "bg-card"}`}>
                    <tr className={isPro ? "border-b border-primary/20" : "border-b border-border"}>
                      <th scope="col" className={`w-10 text-center ${isPro ? "py-1.5" : "pb-3"} text-label text-muted-foreground font-normal`}>
                        <span className="sr-only">Favori</span>
                      </th>
                      <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-left text-label font-normal`}>
                        ISIN
                      </th>
                      <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-left text-label font-normal`}>
                        IHRACÇI
                      </th>
                      <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-left text-label font-normal`}>
                        TUR
                      </th>
                      <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-left text-label font-normal`}>
                        GETIRI TURU
                      </th>
                      <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-center text-label font-normal`}>
                        DOVIZ
                      </th>
                      <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-right text-label font-normal`}>
                        VADE
                      </th>
                      <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-right text-label font-normal`}>
                        SON FIYAT
                      </th>
                      <th scope="col" className={`${isPro ? "py-1.5 text-primary" : "pb-3 text-muted-foreground"} text-right text-label font-normal`}>
                        GETIRI %
                      </th>
                    </tr>
                  </thead>
                  <tbody className={isPro ? "font-mono text-xs" : ""}>
                    {filtered.map((bond) => (
                      <tr
                        key={bond.isin_code}
                        className={`${isPro ? "border-b border-primary/10 hover:bg-primary/5" : "border-b border-border/30 hover:bg-secondary/30"} last:border-0 transition-colors group`}
                      >
                        <td className={`${isPro ? "py-1" : "py-3"} text-center`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => toggleFavorite(e, bond.isin_code)}
                            disabled={favoriteToggling === bond.isin_code}
                            aria-label={favoriteIsins.has(bond.isin_code) ? "Favorilerden çıkar" : "Favorilere ekle"}
                          >
                            <Star
                              className={`h-4 w-4 ${favoriteIsins.has(bond.isin_code) ? "fill-primary text-primary" : "text-muted-foreground"}`}
                            />
                          </Button>
                        </td>
                        <td className={`${isPro ? "py-1 px-2" : "py-3"}`}>
                          <Link
                            href={`/dashboard/bonds/${bond.isin_code}`}
                            className={`font-mono-data text-data-sm ${isPro ? "text-primary hover:text-white" : "text-foreground group-hover:text-primary"} transition-colors`}
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
                        <td className={`${isPro ? "py-1 text-xs text-primary/80" : "py-3 text-data-sm text-muted-foreground"} max-w-[200px] truncate`}>
                          {bond.issuer
                            ? bond.issuer.length > 35
                              ? bond.issuer.substring(0, 35) + "…"
                              : bond.issuer
                            : "—"}
                        </td>
                        <td className={`${isPro ? "py-1 px-2" : "py-3"}`}>
                          {bond.security_type ? (
                            <span className={isPro ? "text-xs text-primary/70" : "text-data-sm text-muted-foreground"}>
                              {bond.security_type.split("/")[0].trim().length > 25
                                ? bond.security_type.split("/")[0].trim().substring(0, 25) + "…"
                                : bond.security_type.split("/")[0].trim()}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={`${isPro ? "py-1 px-2" : "py-3"}`}>
                          {bond.yield_type ? (
                            <span className={isPro ? "text-xs text-primary/70" : "text-data-sm text-muted-foreground"}>
                              {bond.yield_type.split("/")[0].trim().length > 20
                                ? bond.yield_type.split("/")[0].trim().substring(0, 20) + "…"
                                : bond.yield_type.split("/")[0].trim()}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={`${isPro ? "py-1 px-2" : "py-3"} text-center`}>
                          <Badge
                            variant={
                              (CURRENCY_COLORS[bond.currency] as any) || "outline"
                            }
                            className={isPro ? "rounded-none text-[10px] px-1.5 py-0" : ""}
                          >
                            {bond.currency}
                          </Badge>
                        </td>
                        <td className={`${isPro ? "py-1 px-2 text-primary/90" : "py-3 text-muted-foreground"} text-right font-mono-data text-data-sm`}>
                          {bond.days_to_maturity != null
                            ? `${bond.days_to_maturity} gün`
                            : formatDate(bond.maturity_date)}
                        </td>
                        <td className={`${isPro ? "py-1 px-2 text-primary" : "py-3 text-foreground"} text-right font-mono-data text-data-sm`}>
                          {formatDecimal(bond.last_issue_price, 3)}
                        </td>
                        <td className={`${isPro ? "py-1 px-2 font-bold" : "py-3"} text-right font-mono-data text-data-sm text-positive`}>
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
