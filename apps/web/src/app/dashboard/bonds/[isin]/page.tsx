"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Calculator,
  Database,
  FileJson,
  Save,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, VerifiedInstrument, VerifiedValuationResponse } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { formatDate } from "@/lib/utils";


function todayISO() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}


function DecimalValue({ value }: { value: string | null | undefined }) {
  return <span className="font-mono-data">{value ?? "—"}</span>;
}


export default function VerifiedInstrumentDetail({
  params,
}: {
  params: Promise<{ isin: string }>;
}) {
  const { isin } = use(params);
  const [instrument, setInstrument] = useState<VerifiedInstrument | null>(null);
  const [benchmarks, setBenchmarks] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [settlementDate, setSettlementDate] = useState(todayISO());
  const [quoteType, setQuoteType] = useState<"CLEAN_PRICE" | "DIRTY_PRICE" | "ANNUAL_YIELD">("CLEAN_PRICE");
  const [quoteValue, setQuoteValue] = useState("");
  const [cpiRatio, setCpiRatio] = useState("");
  const [explicitDates, setExplicitDates] = useState("");
  const [valuation, setValuation] = useState<VerifiedValuationResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    document.title = `${isin} — Doğrulanmış Değerleme`;
    const token = getToken();
    if (!token) {
      setLoadError("Bu ekranı görüntülemek için giriş yapmalısınız.");
      setLoading(false);
      return;
    }
    Promise.all([
      api.verified.get(token, isin),
      api.verified.benchmarks(token, undefined, 10),
    ])
      .then(([detail, benchmarkResult]) => {
        setInstrument(detail);
        setNote(detail.note_text || "");
        const latest: Record<string, string | null> = {};
        for (const observation of benchmarkResult.items) {
          if (!(observation.benchmark in latest)) {
            latest[observation.benchmark] =
              observation.published_annual_rate_pct;
          }
        }
        setBenchmarks(latest);
      })
      .catch((reason) => setLoadError(reason instanceof Error ? reason.message : "Kıymet yüklenemedi."))
      .finally(() => setLoading(false));
  }, [isin]);

  const benchmarkNames = useMemo(() => {
    const ast = instrument?.term_rule_ast as {
      benchmarks?: Array<{ name?: string }>;
    } | undefined;
    return ast?.benchmarks?.map((item) => item.name).filter(Boolean) ?? [];
  }, [instrument]);
  const requiredBenchmark = instrument?.instrument_family === "PARTICIPATION"
    ? "TLREFK"
    : benchmarkNames.some((name) => name?.includes("TLREFK"))
      ? "TLREFK"
      : benchmarkNames.some((name) => name?.includes("TLREF"))
        ? "TLREF"
        : null;
  const requiresCpi = benchmarkNames.includes("CPI_REFERENCE_INDEX");
  const requiresExplicitDates =
    instrument?.quality.parse_status === "PARTIAL" &&
    Boolean((instrument.term_rule_ast as { coupon_regimes?: unknown[] })?.coupon_regimes?.length);

  const calculate = async () => {
    const token = getToken();
    if (!token || !quoteValue) return;
    setCalculating(true);
    setValuation(null);
    setCalculationError(null);
    try {
      const dates = explicitDates
        .split(/[\s,;]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      const numericQuote = Number(quoteValue);
      if (!Number.isFinite(numericQuote) || numericQuote <= 0) {
        throw new Error("Pozitif bir değer girin.");
      }
      const apiQuoteValue =
        quoteType === "ANNUAL_YIELD"
          ? String(numericQuote / 100)
          : String(numericQuote);
      const result = await api.verified.value(token, {
        isin,
        settlement_date: settlementDate,
        quote_type: quoteType,
        quote_value: apiQuoteValue,
        ...(cpiRatio ? { cpi_ratio: cpiRatio } : {}),
        ...(dates.length ? { explicit_coupon_dates: dates } : {}),
      });
      setValuation(result);
    } catch (reason) {
      setCalculationError(reason instanceof Error ? reason.message : "Değerleme çalıştırılamadı.");
    } finally {
      setCalculating(false);
    }
  };

  const toggleFavorite = async () => {
    const token = getToken();
    if (!token || !instrument) return;
    if (instrument.is_favorite) {
      await api.verified.removeFavorite(token, isin);
    } else {
      await api.verified.addFavorite(token, isin);
    }
    setInstrument({ ...instrument, is_favorite: !instrument.is_favorite });
  };

  const saveNote = async () => {
    const token = getToken();
    if (!token || !note.trim()) return;
    setSavingNote(true);
    try {
      await api.verified.upsertNote(token, isin, note.trim());
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async () => {
    const token = getToken();
    if (!token || !note) return;
    setSavingNote(true);
    try {
      await api.verified.deleteNote(token, isin);
      setNote("");
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Doğrulanmış kaynak yükleniyor…</div>;
  if (!instrument || loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Kıymet açılamadı</AlertTitle>
        <AlertDescription>{loadError || "Kayıt bulunamadı."}</AlertDescription>
      </Alert>
    );
  }

  const fields = instrument.fields;

  return (
    <main className="space-y-6">
      <header>
        <Link href="/dashboard/bonds" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Listeye dön
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono-data text-3xl font-bold">{instrument.isin}</h1>
              <Badge>{instrument.currency}</Badge>
              <Badge variant={instrument.quality.valuation_eligible ? "default" : "destructive"}>
                {instrument.quality.parse_status}
              </Badge>
              {instrument.instrument_family === "PARTICIPATION" && (
                <Badge variant="secondary">Katılım / TLREFK</Badge>
              )}
            </div>
            <p className="mt-2 text-muted-foreground">{instrument.issuer || "İhraççı belirtilmemiş"}</p>
          </div>
          <Button variant="outline" onClick={() => void toggleFavorite()}>
            <Star className={`mr-2 h-4 w-4 ${instrument.is_favorite ? "fill-yellow-400 text-yellow-500" : ""}`} />
            {instrument.is_favorite ? "Favoride" : "Favoriye ekle"}
          </Button>
        </div>
      </header>

      {!instrument.quality.valuation_eligible && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Otomatik değerleme kapalı</AlertTitle>
          <AlertDescription>
            Bu kaydın terimleri {instrument.quality.parse_status} durumunda. Kaynak görüntülenebilir,
            ancak belirsizlik çözülmeden sonuç üretilmez.
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Kaynak</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span>Dosya</span><span className="truncate text-right">{instrument.source.filename || "—"}</span></div>
            <div className="flex justify-between"><span>Veri tarihi</span><span>{formatDate(instrument.source.effective_date)}</span></div>
            <div className="flex justify-between"><span>Tazelik</span><Badge variant={instrument.source.freshness_status === "CURRENT" ? "default" : "secondary"}>{instrument.source.freshness_status === "CURRENT" ? "Güncel" : "Önceki iş günü"}</Badge></div>
            <div className="flex justify-between"><span>Satır</span><DecimalValue value={String(instrument.source.source_row)} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Sözleşme</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>İhraç</span><span>{formatDate(instrument.first_issue_date)}</span></div>
            <div className="flex justify-between"><span>Vade</span><span>{formatDate(instrument.maturity_date)}</span></div>
            <div className="flex justify-between"><span>Kupon sıklığı</span><DecimalValue value={String(instrument.coupon_frequency ?? "—")} /></div>
            <div className="flex justify-between"><span>Day-count</span><span>{String(fields.day_count_convention || "—")}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Benchmark</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Referans</span><span>{requiredBenchmark || (requiresCpi ? "TÜFE" : "Sabit oran")}</span></div>
            {requiredBenchmark && (
              <div className="flex justify-between"><span>{requiredBenchmark} yıllık %</span><DecimalValue value={benchmarks[requiredBenchmark]} /></div>
            )}
            {instrument.instrument_family === "PARTICIPATION" && (
              <div className="text-xs text-muted-foreground">TRD ile başlayan kıymetlerde yalnız TLREFK kullanılır.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Açık girdili değerleme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Fiyat kaynağı</AlertTitle>
            <AlertDescription>
              Son ihraç fiyatı piyasa fiyatı değildir. Bu istek yalnız aşağıdaki kullanıcı girdisini kaydeder ve kullanır.
            </AlertDescription>
          </Alert>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="settlement">Valör tarihi</Label>
              <Input id="settlement" type="date" min={todayISO()} max={instrument.maturity_date || undefined} value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-type">Girdi türü</Label>
              <select
                id="quote-type"
                value={quoteType}
                onChange={(event) => setQuoteType(event.target.value as typeof quoteType)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="CLEAN_PRICE">Temiz fiyat</option>
                <option value="DIRTY_PRICE">Kirli fiyat</option>
                <option value="ANNUAL_YIELD">Yıllık getiri (%)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-value">Değer</Label>
              <Input
                id="quote-value"
                inputMode="decimal"
                value={quoteValue}
                onChange={(event) => setQuoteValue(event.target.value.replace(",", "."))}
                placeholder={quoteType === "ANNUAL_YIELD" ? "42,00" : "100,25"}
              />
            </div>
            {requiresCpi && <div className="space-y-2">
              <Label htmlFor="cpi-ratio">TÜFE endeks oranı (gerekiyorsa)</Label>
              <Input id="cpi-ratio" inputMode="decimal" value={cpiRatio} onChange={(event) => setCpiRatio(event.target.value.replace(",", "."))} placeholder="1.2345" />
            </div>}
            {requiresExplicitDates && <div className="space-y-2 md:col-span-2">
              <Label htmlFor="coupon-dates">Açık kupon tarihleri (düzensiz frekans için)</Label>
              <Input
                id="coupon-dates"
                value={explicitDates}
                onChange={(event) => setExplicitDates(event.target.value)}
                placeholder="2026-03-15, 2026-05-28, 2026-08-10"
              />
            </div>}
          </div>
          <Button
            onClick={() => void calculate()}
            disabled={calculating || !quoteValue || !instrument.quality.valuation_eligible}
          >
            {calculating ? "Hesaplanıyor…" : "Doğrulanmış değerlemeyi çalıştır"}
          </Button>
        </CardContent>
      </Card>

      {calculationError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Değerleme tamamlanamadı</AlertTitle>
          <AlertDescription>{calculationError}</AlertDescription>
        </Alert>
      )}

      {valuation?.failure && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{valuation.failure.code}</AlertTitle>
          <AlertDescription>{valuation.failure.message}</AlertDescription>
        </Alert>
      )}

      {valuation?.result && (
        <section className="space-y-4" aria-label="Değerleme sonucu">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Temiz fiyat", valuation.result.clean_price],
              ["Kirli fiyat", valuation.result.dirty_price],
              ["İşlemiş tutar", valuation.result.accrued_amount],
              ["Yıllık getiri (%)", String(Number(valuation.result.annual_yield) * 100)],
              ["Macaulay duration", valuation.result.macaulay_duration],
              ["Modified duration", valuation.result.modified_duration],
              ["Convexity", valuation.result.convexity],
              ["Etkin kupon (%)", String(Number(valuation.result.effective_coupon_rate) * 100)],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
                <CardContent><DecimalValue value={value} /></CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle>Nakit akışları</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b"><th className="py-2">Tarih</th><th>Kupon</th><th>Anapara</th><th>Toplam</th><th>Bugünkü değer</th></tr></thead>
                <tbody>
                  {valuation.result.cash_flows.map((flow, index) => (
                    <tr key={`${flow.payment_date}-${index}`} className="border-b border-border/50">
                      <td className="py-2">{flow.payment_date}</td>
                      <td><DecimalValue value={flow.coupon_amount} /></td>
                      <td><DecimalValue value={flow.principal_amount} /></td>
                      <td><DecimalValue value={flow.total_amount} /></td>
                      <td><DecimalValue value={flow.present_value} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <details className="rounded-2xl border border-border bg-card">
            <summary className="cursor-pointer p-5 font-semibold">Teknik izlenebilirlik</summary>
            <div className="px-5 pb-5">
              <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs">
                {JSON.stringify(valuation.result.provenance, null, 2)}
              </pre>
            </div>
          </details>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-4 w-4" /> Ham açıklama</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{instrument.remarks_raw || "Açıklama yok."}</CardContent>
        </Card>
        <details className="rounded-2xl border border-border bg-card">
          <summary className="flex cursor-pointer items-center gap-2 p-6 font-semibold"><FileJson className="h-4 w-4" /> Parser ayrıntıları</summary>
          <div className="px-6 pb-6">
            <pre className="max-h-96 overflow-auto rounded-xl bg-muted p-4 text-xs">
              {JSON.stringify(instrument.term_rule_ast, null, 2)}
            </pre>
          </div>
        </details>
      </section>

      <Card>
        <CardHeader><CardTitle>Kişisel not</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} aria-label="Kıymet notu" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void saveNote()} disabled={savingNote || !note.trim()}>
              <Save className="mr-2 h-4 w-4" /> {savingNote ? "Kaydediliyor…" : "Notu kaydet"}
            </Button>
            <Button variant="ghost" onClick={() => void deleteNote()} disabled={savingNote || !note}>
              <Trash2 className="mr-2 h-4 w-4" /> Notu sil
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
