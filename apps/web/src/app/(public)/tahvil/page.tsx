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
  coupon_frequency: string | null;
}

async function fetchBonds(): Promise<PublicBond[]> {
  try {
    const res = await fetch(`${API_BASE}/system/public-bonds?limit=2000`, {
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

export default async function TahvilListPage() {
  const bonds = await fetchBonds();

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
            BIST'te işlem gören{" "}
            <strong className="text-foreground font-medium">{bonds.length}</strong> aktif tahvil, bono,
            kira sertifikası ve VDMK. Detaylı YTM, kirli fiyat ve spread hesaplaması için{" "}
            <Link href="/signup" className="text-primary hover:underline">
              ücretsiz kayıt olun
            </Link>
            .
          </p>
        </div>

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
            <p>Tahvil verileri yüklenemedi. Lütfen daha sonra tekrar deneyin.</p>
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
