"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  Filter,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, VerifiedInstrument } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDate, formatDecimal } from "@/lib/utils";
import { tr } from "@/locales/tr";

const STATUS_LABEL: Record<VerifiedInstrument["quality"]["parse_status"], string> = {
  EXACT: "Doğrulandı",
  PARTIAL: "Kısmi",
  AMBIGUOUS: "Belirsiz",
  CONFLICTING: "Çelişkili",
  REJECTED: "Reddedildi",
};

const STATUS_VARIANT: Record<
  VerifiedInstrument["quality"]["parse_status"],
  "positive" | "secondary" | "destructive" | "outline"
> = {
  EXACT: "positive",
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<{
    published_versions: number;
    valuation_eligible_versions: number;
  } | null>(null);

  useEffect(() => {
    document.title = "Kıymet Evreni — Bondley";
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Bu ekranı görüntülemek için giriş yapmalısınız.");
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      Promise.all([
        api.verified.list(token, {
          skip: page * 50,
          limit: 50,
          search: search.trim() || undefined,
          parse_status: statusFilter || undefined,
          valuation_eligible: eligibleOnly ? true : undefined,
          active_only: true,
          order_by: "maturity",
        }),
        api.verified.favorites(token),
        api.verified.quality(token),
      ])
        .then(([instruments, favoriteResult, qualityResult]) => {
          setItems(instruments.items);
          setTotal(instruments.total);
          setFavorites(new Set(favoriteResult.items));
          setQuality(qualityResult);
          setError(null);
        })
        .catch((reason) =>
          setError(reason instanceof Error ? reason.message : "Veriler yüklenemedi."),
        )
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [eligibleOnly, page, search, statusFilter]);

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

  if (loading && items.length === 0) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-[520px] w-full rounded-3xl" />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div role="alert" className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 font-semibold text-destructive">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      </div>
    );
  }

  const eligibleCount =
    quality?.valuation_eligible_versions ??
    items.filter((item) => item.quality.valuation_eligible).length;

  return (
    <main className="space-y-6">
      <header className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Çalışma alanı
          </Link>
          <div className="mt-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Database className="h-4.5 w-4.5" />
            </span>
            <p className="eyebrow text-primary">Doğrulanmış BIST evreni</p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {tr.dashboard.bonds.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Kıymeti seçtiğiniz anda Bondley, nominal 100 temiz fiyat varsayımıyla teorik
            değerlemeyi otomatik hazırlar.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="data-surface widget-blue min-w-32 rounded-2xl px-4 py-3">
            <span className="eyebrow block">Yayımlanan</span>
            <span className="metric-value mt-2 block text-2xl">
              {formatDecimal(quality?.published_versions ?? total, 0)}
            </span>
          </div>
          <div className="data-surface widget-green min-w-32 rounded-2xl px-4 py-3">
            <span className="eyebrow block">Değerlenebilir</span>
            <span className="metric-value mt-2 block text-2xl text-positive">
              {formatDecimal(eligibleCount, 0)}
            </span>
          </div>
        </div>
      </header>

      <section className="data-surface rounded-2xl p-3 sm:p-4" aria-label="Kıymet filtreleri">
        <div className="grid gap-3 lg:grid-cols-[1fr_190px_auto]">
          <label className="relative">
            <span className="sr-only">ISIN veya ihraççı ara</span>
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder={tr.dashboard.bonds.filters.searchPlaceholder}
              className="h-11 rounded-xl border-transparent bg-muted/60 pl-11 focus-visible:bg-background"
            />
          </label>
          <label className="relative">
            <span className="sr-only">Veri doğrulama durumu</span>
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(0);
              }}
              className="h-11 w-full appearance-none rounded-xl border border-transparent bg-muted/60 pl-11 pr-4 text-sm outline-none focus:border-primary/30 focus:bg-background"
            >
              <option value="">Tüm veri durumları</option>
              <option value="EXACT">Doğrulandı</option>
              <option value="PARTIAL">Kısmi</option>
              <option value="AMBIGUOUS">Belirsiz</option>
              <option value="CONFLICTING">Çelişkili</option>
            </select>
          </label>
          <button
            type="button"
            aria-pressed={eligibleOnly}
            onClick={() => {
              setEligibleOnly((value) => !value);
              setPage(0);
            }}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold ${
              eligibleOnly
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-transparent bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                eligibleOnly ? "bg-primary text-white" : "border border-border bg-background"
              }`}
            >
              {eligibleOnly && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            Değerlemeye hazır
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="data-surface overflow-hidden rounded-3xl">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <caption className="sr-only">Doğrulanmış BIST kıymetleri</caption>
            <thead>
              <tr className="border-b border-border/70 text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground">
                <th className="px-6 py-4">{tr.dashboard.bonds.table.cols.isin} / {tr.dashboard.bonds.table.cols.issuer}</th>
                <th className="px-5 py-4">{tr.dashboard.bonds.table.cols.maturity}</th>
                <th className="px-5 py-4">Referans / {tr.dashboard.bonds.table.cols.type}</th>
                <th className="px-5 py-4">Durum</th>
                <th className="px-5 py-4">Değerleme bazı</th>
                <th className="w-24 px-5 py-4"><span className="sr-only">İşlemler</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/55">
              {items.map((item) => (
                <tr key={item.id} className="group hover:bg-muted/30">
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/bonds/${item.isin}`}
                      className="font-mono-data text-[14px] text-foreground group-hover:text-primary"
                    >
                      {item.isin}
                    </Link>
                    <div className="mt-1 max-w-[360px] truncate text-xs text-muted-foreground">
                      {item.issuer || "İhraççı belirtilmemiş"}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-mono-data text-[13px]">{formatDate(item.maturity_date)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {item.days_to_maturity == null ? "—" : `${item.days_to_maturity} gün`}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-medium">
                      {item.instrument_family === "PARTICIPATION" ? "TLREFK" : item.yield_type || "Sabit"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {item.instrument_family === "PARTICIPATION" ? "Katılım kıymeti" : item.security_type || "Standart"}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={STATUS_VARIANT[item.quality.parse_status]}>
                      {STATUS_LABEL[item.quality.parse_status]}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    {item.quality.valuation_eligible ? (
                      <span className="assumption-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Nominal 100
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">İnceleme gerekli</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void toggleFavorite(item)}
                        aria-label={favorites.has(item.isin) ? "Favoriden çıkar" : "Favoriye ekle"}
                        className="rounded-full"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            favorites.has(item.isin)
                              ? "fill-amber-400 text-amber-500"
                              : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                      <Button asChild variant="ghost" size="icon" className="rounded-full">
                        <Link href={`/dashboard/bonds/${item.isin}`} aria-label={`${item.isin} ayrıntıları`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-border/60 md:hidden">
          {items.map((item) => (
            <article key={item.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <Link href={`/dashboard/bonds/${item.isin}`} className="min-w-0">
                  <span className="font-mono-data block text-[15px] text-foreground">{item.isin}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {item.issuer || "İhraççı belirtilmemiş"}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void toggleFavorite(item)}
                  aria-label={favorites.has(item.isin) ? "Favoriden çıkar" : "Favoriye ekle"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/70"
                >
                  <Star
                    className={`h-4 w-4 ${
                      favorites.has(item.isin) ? "fill-amber-400 text-amber-500" : "text-muted-foreground"
                    }`}
                  />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <span className="eyebrow block">Vade</span>
                  <span className="font-mono-data mt-1.5 block text-xs">{formatDate(item.maturity_date)}</span>
                </div>
                <div>
                  <span className="eyebrow block">Referans</span>
                  <span className="mt-1.5 block text-xs font-semibold">
                    {item.instrument_family === "PARTICIPATION" ? "TLREFK" : item.yield_type || "Sabit"}
                  </span>
                </div>
                <div>
                  <span className="eyebrow block">Durum</span>
                  <span className="mt-1.5 block text-xs font-semibold">
                    {STATUS_LABEL[item.quality.parse_status]}
                  </span>
                </div>
              </div>
              <Link
                href={`/dashboard/bonds/${item.isin}`}
                className="mt-4 flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 text-sm font-semibold"
              >
                {item.quality.valuation_eligible ? "Otomatik değerlemeyi aç" : "Kıymet ayrıntısını aç"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        {items.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-muted-foreground">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Database className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm">Filtrelerle eşleşen kıymet bulunamadı.</p>
          </div>
        )}
      </section>

      <nav className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Sayfalama">
        <span className="text-xs text-muted-foreground">
          {total} kayıttan {total === 0 ? 0 : page * 50 + 1}–{Math.min((page + 1) * 50, total)}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" /> Önceki
          </Button>
          <Button
            variant="outline"
            disabled={(page + 1) * 50 >= total}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-xl"
          >
            Sonraki <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </nav>
    </main>
  );
}
