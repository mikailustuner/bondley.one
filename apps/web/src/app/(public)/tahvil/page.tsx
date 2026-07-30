import Link from "next/link";
import type { Metadata } from "next";

const SITE_URL = "https://bondley.one";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Türkiye Tahvil ve Bono Listesi",
  description:
    "BIST'te işlem gören aktif tahvil, bono, kira sertifikası ve VDMK listesi. YTM hesaplama ve detaylı spread analizi için Bondley'e ücretsiz kayıt olun.",
  keywords: [
    "tahvil listesi",
    "bono listesi",
    "kira sertifikası listesi",
    "BIST tahvil",
    "Türkiye borçlanma araçları",
    "aktif tahvil",
    "vadeye kadar getiri",
  ],
  alternates: { canonical: `${SITE_URL}/tahvil` },
  openGraph: {
    title: "Türkiye Tahvil ve Bono Listesi | Bondley",
    description: "BIST'te işlem gören aktif borçlanma araçlarının tam listesi.",
    url: `${SITE_URL}/tahvil`,
    type: "website",
  },
};

interface PublicBond {
  isin_code: string;
  issuer: string | null;
  security_type: string | null;
  yield_type: string | null;
  currency: string;
  maturity_date: string | null;
  is_active: boolean;
  coupon_frequency: string | null;
}

type PublicBondStatus = "active" | "matured" | "all";

const STATUS_OPTIONS: Array<{ value: PublicBondStatus; label: string }> = [
  { value: "active", label: "Aktif" },
  { value: "matured", label: "Vadesi Dolmuş" },
  { value: "all", label: "Tümü" },
];

async function fetchBonds(
  status: PublicBondStatus,
  search: string,
): Promise<PublicBond[]> {
  try {
    const query = new URLSearchParams({ limit: "3000", status });
    if (search) query.set("search", search);
    const res = await fetch(`${API_BASE}/system/public-bonds?${query}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function TahvilListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const query = await searchParams;
  const status: PublicBondStatus =
    query.status === "matured" || query.status === "all" ? query.status : "active";
  const search = query.q?.trim().slice(0, 100) || "";
  const bonds = await fetchBonds(status, search);
  const listDescription =
    status === "active"
      ? "aktif tahvil, bono, kira sertifikası ve VDMK"
      : status === "matured"
        ? "vadesi dolmuş borçlanma aracı"
        : "aktif ve vadesi dolmuş borçlanma aracı";

  function statusHref(value: PublicBondStatus): string {
    const params = new URLSearchParams();
    if (value !== "active") params.set("status", value);
    if (search) params.set("q", search);
    const suffix = params.toString();
    return suffix ? `/tahvil?${suffix}` : "/tahvil";
  }

  const listSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Türkiye Borçlanma Araçları Listesi",
    description: "BIST'te işlem gören aktif tahvil, bono, kira sertifikası ve VDMK",
    numberOfItems: bonds.length,
    url: `${SITE_URL}/tahvil`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listSchema) }}
      />
      <main className="container mx-auto px-4 py-10 max-w-6xl">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 flex-wrap">
            <li>
              <Link href="/landing" className="hover:text-foreground transition-colors">
                Anasayfa
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium">Tahvil Listesi</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
            Türkiye Borçlanma Araçları
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl leading-relaxed">
            BIST evrenindeki{" "}
            <strong className="text-foreground font-medium">{bonds.length}</strong>{" "}
            {listDescription}. Detaylı YTM, kirli fiyat ve spread analizi için{" "}
            <Link href="/signup" className="text-primary hover:underline">
              ücretsiz kayıt olun
            </Link>
            .
          </p>
        </div>

        <section className="mb-6 rounded-xl border border-border bg-muted/20 p-3" aria-label="Tahvil filtreleri">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <nav className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1" aria-label="Vade durumu">
              {STATUS_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={statusHref(option.value)}
                  aria-current={status === option.value ? "page" : undefined}
                  className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                    status === option.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
            <form method="get" action="/tahvil" className="flex min-w-0 gap-2 sm:w-[360px]">
              {status !== "active" && <input type="hidden" name="status" value={status} />}
              <label htmlFor="bond-search" className="sr-only">
                ISIN veya ihraççı ara
              </label>
              <input
                id="bond-search"
                name="q"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="ISIN veya ihraççı ara"
                className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Ara
              </button>
            </form>
          </div>
        </section>

        {/* Bond table */}
        {bonds.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    ISIN Kodu
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">İhraçcı</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    Tür
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">
                    Getiri Tipi
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                    Para Birimi
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    Vade Tarihi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bonds.map((bond) => (
                  <tr key={bond.isin_code} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/tahvil/${bond.isin_code}`}
                        className="font-mono text-primary hover:underline font-medium text-xs"
                      >
                        {bond.isin_code}
                      </Link>
                      {!bond.is_active && (
                        <span className="ml-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Vadesi doldu
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground text-xs leading-snug max-w-[180px] truncate">
                      {bond.issuer || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell whitespace-nowrap">
                      {bond.security_type || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell whitespace-nowrap">
                      {bond.yield_type || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                      {bond.currency}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(bond.maturity_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p>
              {search
                ? `"${search}" aramasıyla eşleşen kıymet bulunamadı.`
                : "Bu görünümde listelenecek kıymet bulunamadı."}
            </p>
            {status === "active" && search && (
              <Link
                href={`/tahvil?status=all&q=${encodeURIComponent(search)}`}
                className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
              >
                Vadesi dolmuş kıymetlerde de ara
              </Link>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 p-6 rounded-xl bg-muted/30 border border-border text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Detaylı Analiz için Kayıt Olun</h2>
          <p className="text-muted-foreground mb-4 max-w-lg mx-auto">
            YTM, kirly fiyat, birikmiş faiz, durasyon ve spread hesaplaması — tamamen ücretsiz.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Ücretsiz Başla
          </Link>
        </div>
      </main>
    </>
  );
}
