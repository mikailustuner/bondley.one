"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  Database,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    Promise.all([
      api.verified.dashboardSummary(token),
      api.verified.favorites(token),
    ])
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
    }, 250);
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
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 rounded-3xl" />)}
        </div>
      </div>
    );
  }

  return (
    <main className="space-y-7">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-display-lg tracking-tight">{greeting()}, {userName}.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("tr-TR", {
              timeZone: "Europe/Istanbul",
              dateStyle: "full",
            }).format(new Date())}
          </p>
        </div>
        <div ref={searchRef} className="relative w-full lg:max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ISIN veya ihraççı ara"
            className="h-12 rounded-full pl-12"
            aria-label="Kıymet ara"
          />
          {query.trim().length >= 2 && (
            <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border bg-card shadow-xl">
              {searching && <div className="p-4 text-sm text-muted-foreground">Aranıyor…</div>}
              {!searching && results.map((item) => (
                <button
                  key={item.isin}
                  type="button"
                  onClick={() => goToInstrument(item.isin)}
                  className="flex w-full items-center justify-between border-b px-4 py-3 text-left last:border-0 hover:bg-muted/50"
                >
                  <span>
                    <span className="block font-mono-data text-sm font-semibold">{item.isin}</span>
                    <span className="block max-w-md truncate text-xs text-muted-foreground">
                      {item.issuer || "İhraççı belirtilmemiş"}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
              {!searching && results.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">Eşleşen kıymet yok.</div>
              )}
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {summary && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(["TLREF", "TLREFK"] as const).map((name) => {
              const item = summary.benchmarks[name];
              return (
                <Card key={name}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                      {name} yayımlanan yıllık oran
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="font-mono-data text-3xl font-bold">
                      {item?.published_annual_rate_pct == null
                        ? "—"
                        : `%${Number(item.published_annual_rate_pct).toLocaleString("tr-TR", { maximumFractionDigits: 4 })}`}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item ? formatDate(item.observation_date) : "Veri bekleniyor"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
            <Link href="/dashboard/bonds">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                    Aktif kıymet
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono-data text-3xl font-bold">
                    {formatDecimal(summary.active_instruments, 0)}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {summary.valuation_eligible} kayıt değerlemeye uygun
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  Kaynak durumu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <Badge variant={summary.source?.freshness_status === "CURRENT" ? "default" : "secondary"}>
                    {summary.source?.freshness_status === "CURRENT" ? "Güncel" : "Önceki iş günü"}
                  </Badge>
                </div>
                <p className="mt-3 truncate text-xs text-muted-foreground">
                  {summary.source?.filename || "Kaynak bekleniyor"}
                  {summary.source?.effective_date ? ` · ${formatDate(summary.source.effective_date)}` : ""}
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4" /> 90 gün içinde vadesi gelenler
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.maturing_soon.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bu aralıkta kıymet yok.</p>
                ) : summary.maturing_soon.map((item) => (
                  <Link
                    key={item.isin}
                    href={`/dashboard/bonds/${item.isin}`}
                    className="flex items-center justify-between rounded-xl px-2 py-3 hover:bg-muted/50"
                  >
                    <span>
                      <span className="block font-mono-data text-sm font-semibold">{item.isin}</span>
                      <span className="block max-w-sm truncate text-xs text-muted-foreground">{item.issuer || "—"}</span>
                    </span>
                    <span className="text-sm text-muted-foreground">{item.days_to_maturity} gün</span>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="h-4 w-4 text-yellow-500" /> Favoriler
                </CardTitle>
              </CardHeader>
              <CardContent>
                {favorites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Henüz favori kıymet eklemediniz.</p>
                ) : favorites.slice(0, 8).map((item) => (
                  <Link
                    key={item.isin}
                    href={`/dashboard/bonds/${item.isin}`}
                    className="flex items-center justify-between rounded-xl px-2 py-3 hover:bg-muted/50"
                  >
                    <span>
                      <span className="block font-mono-data text-sm font-semibold">{item.isin}</span>
                      <span className="block max-w-sm truncate text-xs text-muted-foreground">{item.issuer || "—"}</span>
                    </span>
                    <ShieldCheck className={`h-4 w-4 ${item.quality.valuation_eligible ? "text-positive" : "text-muted-foreground"}`} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </main>
  );
}
