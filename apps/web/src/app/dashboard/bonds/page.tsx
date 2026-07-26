"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Database, Search, ShieldCheck, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, VerifiedInstrument } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDate } from "@/lib/utils";


const STATUS_VARIANT: Record<
  VerifiedInstrument["quality"]["parse_status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  EXACT: "default",
  PARTIAL: "secondary",
  AMBIGUOUS: "outline",
  CONFLICTING: "destructive",
  REJECTED: "destructive",
};


export default function BondsListPage() {
  const [items, setItems] = useState<VerifiedInstrument[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<{
    published_versions: number;
    valuation_eligible_versions: number;
  } | null>(null);

  useEffect(() => {
    document.title = "Doğrulanmış BIST Kıymetleri — Bondley";
    const token = getToken();
    if (!token) {
      setError("Bu ekranı görüntülemek için giriş yapmalısınız.");
      setLoading(false);
      return;
    }
    Promise.all([
      api.verified.list(token, { limit: 3000 }),
      api.verified.favorites(token),
      api.verified.quality(token),
    ])
      .then(([instruments, favoriteResult, qualityResult]) => {
        setItems(instruments.items);
        setFavorites(new Set(favoriteResult.items));
        setQuality(qualityResult);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Veriler yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const candidate = search.trim().toLocaleUpperCase("tr-TR");
    return items.filter((item) => {
      if (
        candidate &&
        !item.isin.includes(candidate) &&
        !item.issuer?.toLocaleUpperCase("tr-TR").includes(candidate)
      ) {
        return false;
      }
      if (statusFilter && item.quality.parse_status !== statusFilter) return false;
      if (eligibleOnly && !item.quality.valuation_eligible) return false;
      return true;
    });
  }, [eligibleOnly, items, search, statusFilter]);

  const toggleFavorite = async (instrument: VerifiedInstrument) => {
    const token = getToken();
    if (!token) return;
    const next = new Set(favorites);
    if (next.has(instrument.isin)) {
      await api.verified.removeFavorite(token, instrument.isin);
      next.delete(instrument.isin);
    } else {
      await api.verified.addFavorite(token, instrument.isin);
      next.add(instrument.isin);
    }
    setFavorites(next);
  };

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 font-semibold text-destructive">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <main className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <span className="text-sm font-semibold">BIST doğrulanmış veri hattı</span>
        </div>
        <h1 className="mt-2 text-display-md text-foreground">Borçlanma araçları</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Kaynak, parse kalitesi ve değerleme uygunluğu birbirinden ayrıdır. Piyasa fiyatı
          gösterilmez; değerleme için temiz fiyat, kirli fiyat veya getiri girmelisiniz.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Veri kalitesi özeti">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Yayımlanan sürüm</CardTitle>
          </CardHeader>
          <CardContent className="font-mono-data text-3xl font-bold">
            {quality?.published_versions ?? items.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Değerlemeye uygun</CardTitle>
          </CardHeader>
          <CardContent className="font-mono-data text-3xl font-bold text-primary">
            {quality?.valuation_eligible_versions ?? items.filter((item) => item.quality.valuation_eligible).length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Fiyat politikası</CardTitle>
          </CardHeader>
          <CardContent className="text-base font-semibold">Yalnız kullanıcı girdisi</CardContent>
        </Card>
      </section>

      <section className="rounded-3xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <label className="relative">
            <span className="sr-only">ISIN veya ihraççı ara</span>
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ISIN veya ihraççı ara"
              className="pl-9"
            />
          </label>
          <label>
            <span className="sr-only">Parse durumu</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Tüm parse durumları</option>
              <option value="EXACT">Exact</option>
              <option value="PARTIAL">Partial</option>
              <option value="AMBIGUOUS">Ambiguous</option>
              <option value="CONFLICTING">Conflicting</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border px-3 text-sm">
            <input
              type="checkbox"
              checked={eligibleOnly}
              onChange={(event) => setEligibleOnly(event.target.checked)}
            />
            Yalnız değerlemeye uygun
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Doğrulanmış BIST kıymetleri</caption>
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ISIN / ihraççı</th>
                <th className="px-4 py-3">Vade</th>
                <th className="px-4 py-3">Tür</th>
                <th className="px-4 py-3">Kalite</th>
                <th className="px-4 py-3">Fiyat</th>
                <th className="px-4 py-3"><span className="sr-only">İşlemler</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/25">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/bonds/${item.isin}`}
                      className="font-mono-data font-semibold text-primary hover:underline"
                    >
                      {item.isin}
                    </Link>
                    <div className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                      {item.issuer || "İhraççı belirtilmemiş"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{formatDate(item.maturity_date)}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.days_to_maturity == null ? "—" : `${item.days_to_maturity} gün`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      {item.instrument_family === "PARTICIPATION" ? "Katılım / TLREFK" : item.yield_type || "Standart"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[item.quality.parse_status]}>
                      {item.quality.parse_status}
                    </Badge>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.quality.valuation_eligible ? "Değerlemeye uygun" : "İnceleme gerekli"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    Kullanıcı girdisi gerekli
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleFavorite(item)}
                      aria-label={favorites.has(item.isin) ? "Favoriden çıkar" : "Favoriye ekle"}
                    >
                      <Star className={`h-4 w-4 ${favorites.has(item.isin) ? "fill-yellow-400 text-yellow-500" : ""}`} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-12 text-muted-foreground">
            <Database className="h-7 w-7" aria-hidden />
            Filtrelerle eşleşen kıymet bulunamadı.
          </div>
        )}
      </section>
    </main>
  );
}
