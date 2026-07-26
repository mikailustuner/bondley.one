"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Database,
  Gauge,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, VerifiedInstrument } from "@/lib/api-client";
import { getToken, getUser } from "@/lib/auth";
import { formatDate, formatDecimal } from "@/lib/utils";

type Summary = Awaited<ReturnType<typeof api.verified.dashboardSummary>>;

function turkeyHour(): number {
  return Number(
    new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
}

function greeting(): string {
  const hour = turkeyHour();
  if (hour < 6) return "İyi geceler";
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

function BenchmarkCard({
  name,
  item,
}: {
  name: "TLREF" | "TLREFK";
  item: Summary["benchmarks"]["TLREF"];
}) {
  const value =
    item?.published_annual_rate_pct == null
      ? "—"
      : Number(item.published_annual_rate_pct).toLocaleString("tr-TR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        });

  return (
    <article className="data-surface relative overflow-hidden rounded-[28px] p-5 sm:p-6">
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="eyebrow">{name} referans oranı</p>
          <div className="mt-5 flex items-start gap-1">
            <span className="mt-1.5 text-lg font-semibold text-muted-foreground">%</span>
            <span className="metric-value text-[2.55rem] sm:text-5xl">{value}</span>
          </div>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
          <Gauge className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-xs">
        <span className="text-muted-foreground">Yayımlanan yıllık oran</span>
        <span className="font-mono-data text-foreground">
          {item ? formatDate(item.observation_date) : "Veri bekleniyor"}
        </span>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [favorites, setFavorites] = useState<VerifiedInstrument[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VerifiedInstrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userName = getUser()?.full_name?.split(" ")[0] || "Kullanıcı";

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    Promise.all([api.verified.dashboardSummary(token), api.verified.favorites(token)])
      .then(([summaryResult, favoriteResult]) => {
        setSummary(summaryResult);
        setFavorites(favoriteResult.details);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Dashboard yüklenemedi."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const token = getToken();
    if (!token) return;
    const timer = window.setTimeout(() => {
      setSearching(true);
      api.verified
        .list(token, { search: query.trim(), limit: 8, active_only: true })
        .then((response) => setResults(response.items))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setResults([]);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const goToInstrument = (isin: string) => {
    setQuery("");
    setResults([]);
    router.push(`/dashboard/bonds/${encodeURIComponent(isin)}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-[32px]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-48 rounded-[28px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="space-y-6 lg:space-y-8">
      <header className="data-surface relative overflow-visible rounded-[32px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
          <div className="absolute -right-24 -top-36 h-80 w-80 rounded-full bg-primary/12 blur-3xl" />
          <div className="absolute bottom-[-9rem] left-[38%] h-72 w-72 rounded-full bg-accent/8 blur-3xl" />
          <div className="soft-grid absolute inset-0 opacity-30" />
        </div>
        <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/[0.055] px-3 py-1.5 text-[11px] font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              BIST doğrulanmış veri çalışma alanı
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-[2.6rem] sm:leading-[1.05]">
              {greeting()}, {userName}.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {new Intl.DateTimeFormat("tr-TR", {
                timeZone: "Europe/Istanbul",
                dateStyle: "full",
              }).format(new Date())}
            </p>
          </div>

          <div ref={searchRef} className="relative">
            <div className="relative">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ISIN ya da ihraççı ile kıymet bulun"
                className="h-14 rounded-2xl border-border/70 bg-background/70 pl-14 pr-12 text-[15px] shadow-sm placeholder:text-muted-foreground/70 focus-visible:border-primary/35 focus-visible:bg-card"
                aria-label="Kıymet ara"
              />
              <kbd className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-lg border border-border/70 bg-muted/60 px-2 py-1 text-[10px] text-muted-foreground sm:block">
                ISIN
              </kbd>
            </div>
            {query.trim().length >= 2 && (
              <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl">
                {searching && <div className="p-4 text-sm text-muted-foreground">Aranıyor…</div>}
                {!searching &&
                  results.map((item) => (
                    <button
                      key={item.isin}
                      type="button"
                      onClick={() => goToInstrument(item.isin)}
                      className="flex w-full items-center justify-between border-b border-border/60 px-4 py-3.5 text-left last:border-0 hover:bg-muted/60"
                    >
                      <span className="min-w-0">
                        <span className="font-mono-data block text-sm">{item.isin}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {item.issuer || "İhraççı belirtilmemiş"}
                        </span>
                      </span>
                      <ArrowRight className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                {!searching && results.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">Eşleşen kıymet yok.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {summary && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Piyasa özeti">
            <BenchmarkCard name="TLREF" item={summary.benchmarks.TLREF} />
            <BenchmarkCard name="TLREFK" item={summary.benchmarks.TLREFK} />

            <Link
              href="/dashboard/bonds"
              className="data-surface group rounded-[28px] p-5 transition-transform hover:-translate-y-0.5 sm:p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="eyebrow">Aktif kıymet evreni</p>
                  <p className="metric-value mt-5 text-[2.55rem] sm:text-5xl">
                    {formatDecimal(summary.active_instruments, 0)}
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Database className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-xs">
                <span className="text-muted-foreground">
                  {summary.valuation_eligible} değerlemeye uygun
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <article className="data-surface rounded-[28px] p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="eyebrow">Veri bütünlüğü</p>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-positive/10 text-positive">
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    </span>
                    <span className="text-xl font-semibold tracking-tight">
                      {summary.source?.freshness_status === "CURRENT" ? "Güncel" : "Önceki iş günü"}
                    </span>
                  </div>
                </div>
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-6 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                <p className="truncate">{summary.source?.filename || "Kaynak bekleniyor"}</p>
                {summary.source?.effective_date && (
                  <p className="font-mono-data mt-1 text-foreground">
                    {formatDate(summary.source.effective_date)}
                  </p>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="data-surface overflow-hidden rounded-[28px]">
              <div className="flex items-center justify-between px-5 py-5 sm:px-6">
                <div>
                  <p className="eyebrow">Vade takvimi</p>
                  <h2 className="mt-1.5 text-lg font-semibold tracking-tight">
                    Yaklaşan geri ödemeler
                  </h2>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                  <CalendarDays className="h-5 w-5" />
                </span>
              </div>
              <div className="hairline-list border-t border-border/60">
                {summary.maturing_soon.length === 0 ? (
                  <p className="px-6 py-10 text-sm text-muted-foreground">
                    Önümüzdeki 90 gün içinde vadesi gelen kıymet yok.
                  </p>
                ) : (
                  summary.maturing_soon.slice(0, 6).map((item) => (
                    <Link
                      key={item.isin}
                      href={`/dashboard/bonds/${item.isin}`}
                      className="group grid grid-cols-[1fr_auto] items-center gap-5 px-5 py-4 hover:bg-muted/35 sm:px-6"
                    >
                      <span className="min-w-0">
                        <span className="font-mono-data block text-[14px]">{item.isin}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {item.issuer || "İhraççı belirtilmemiş"}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="metric-value block text-xl">{item.days_to_maturity}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">gün</span>
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </article>

            <article className="data-surface overflow-hidden rounded-[28px]">
              <div className="flex items-center justify-between px-5 py-5 sm:px-6">
                <div>
                  <p className="eyebrow">Kişisel alan</p>
                  <h2 className="mt-1.5 text-lg font-semibold tracking-tight">Favori kıymetler</h2>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-500">
                  <Star className="h-5 w-5 fill-current" />
                </span>
              </div>
              <div className="hairline-list border-t border-border/60">
                {favorites.length === 0 ? (
                  <div className="px-6 py-10">
                    <p className="text-sm text-muted-foreground">Henüz favori kıymet eklemediniz.</p>
                    <Link
                      href="/dashboard/bonds"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      Kıymetleri keşfet <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  favorites.slice(0, 6).map((item) => (
                    <Link
                      key={item.isin}
                      href={`/dashboard/bonds/${item.isin}`}
                      className="group flex items-center justify-between gap-5 px-5 py-4 hover:bg-muted/35 sm:px-6"
                    >
                      <span className="min-w-0">
                        <span className="font-mono-data block text-[14px]">{item.isin}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {item.issuer || "İhraççı belirtilmemiş"}
                        </span>
                      </span>
                      <Badge variant={item.quality.valuation_eligible ? "positive" : "secondary"}>
                        {item.quality.valuation_eligible ? "Hazır" : "İncele"}
                      </Badge>
                    </Link>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
