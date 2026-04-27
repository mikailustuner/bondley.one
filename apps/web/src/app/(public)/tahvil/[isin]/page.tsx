import Link from "next/link";
import type { Metadata } from "next";

const SITE_URL = "https://bondley.one";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const revalidate = 3600;

interface PublicBondDetail {
  isin_code: string;
  issuer: string | null;
  security_type: string | null;
  yield_type: string | null;
  currency: string;
  maturity_date: string | null;
  coupon_frequency: string | null;
  first_issue_date: string | null;
  total_issue_amount: number | null;
  next_coupon_date: string | null;
  updated_at: string | null;
}

async function fetchBond(isin: string): Promise<PublicBondDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/system/public-bonds/${isin}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ isin: string }>;
}): Promise<Metadata> {
  const { isin } = await params;
  const bond = await fetchBond(isin);

  if (!bond) {
    return {
      title: `${isin} | Bondley`,
      description: `${isin} ISIN kodlu borçlanma aracı hakkında bilgi. Bondley'de detaylı YTM ve fiyat analizi yapın.`,
    };
  }

  const issuer = bond.issuer || isin;
  const secType = bond.security_type || "Borçlanma Aracı";
  const maturity = bond.maturity_date
    ? new Date(bond.maturity_date).toLocaleDateString("tr-TR", { year: "numeric", month: "long" })
    : null;

  const title = `${isin} – ${issuer}`;
  const description = `${issuer} tarafından ihraç edilen ${secType}${maturity ? `, vade: ${maturity}` : ""}. ${bond.currency} cinsinden BIST'te işlem gören borçlanma aracı. Bondley'de ücretsiz YTM, kirli fiyat ve spread analizi yapın.`;

  return {
    title,
    description,
    keywords: [
      isin,
      issuer,
      secType,
      bond.yield_type || "",
      "tahvil analizi",
      "YTM hesaplama",
      "BIST tahvil",
    ].filter(Boolean),
    alternates: { canonical: `${SITE_URL}/tahvil/${isin}` },
    openGraph: {
      title: `${title} | Bondley`,
      description,
      url: `${SITE_URL}/tahvil/${isin}`,
      type: "website",
    },
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatAmount(amount: number | null): string {
  if (!amount) return "—";
  return (
    new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(
      amount
    ) + " ₺"
  );
}

export default async function TahvilDetailPage({
  params,
}: {
  params: Promise<{ isin: string }>;
}) {
  const { isin } = await params;
  const bond = await fetchBond(isin);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Anasayfa", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Tahvil Listesi", item: `${SITE_URL}/tahvil` },
      { "@type": "ListItem", position: 3, name: isin, item: `${SITE_URL}/tahvil/${isin}` },
    ],
  };

  const breadcrumb = (
    <nav className="text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 flex-wrap">
        <li>
          <Link href="/landing" className="hover:text-foreground transition-colors">
            Anasayfa
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link href="/tahvil" className="hover:text-foreground transition-colors">
            Tahvil Listesi
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="text-foreground font-medium font-mono text-xs">{isin}</li>
      </ol>
    </nav>
  );

  if (!bond) {
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
        <main className="container mx-auto px-4 py-10 max-w-4xl">
          {breadcrumb}
          <h1 className="text-2xl font-bold text-foreground mb-4 font-mono">{isin}</h1>
          <p className="text-muted-foreground mb-6">
            Bu tahvile ait bilgiler şu an mevcut değil veya tahvil vadesi dolmuş olabilir.
          </p>
          <Link
            href="/tahvil"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            ← Tüm Tahvillere Dön
          </Link>
        </main>
      </>
    );
  }

  const detailRows = [
    { label: "ISIN Kodu", value: bond.isin_code, mono: true },
    { label: "İhraçcı", value: bond.issuer },
    { label: "Menkul Kıymet Türü", value: bond.security_type },
    { label: "Getiri Tipi", value: bond.yield_type },
    { label: "Para Birimi", value: bond.currency },
    { label: "Kupon Sıklığı", value: bond.coupon_frequency },
    { label: "İlk İhraç Tarihi", value: formatDate(bond.first_issue_date) },
    { label: "Vade Tarihi", value: formatDate(bond.maturity_date) },
    { label: "Sonraki Kupon Tarihi", value: formatDate(bond.next_coupon_date) },
    { label: "Toplam İhraç Tutarı", value: formatAmount(bond.total_issue_amount) },
  ];

  const bondSchema = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    name: `${bond.isin_code} – ${bond.issuer || ""}`,
    description: `${bond.issuer} tarafından ihraç edilen ${bond.security_type || "borçlanma aracı"}`,
    url: `${SITE_URL}/tahvil/${bond.isin_code}`,
    identifier: bond.isin_code,
    currency: bond.currency,
    category: bond.security_type,
    provider: { "@type": "Organization", name: "Bondley", url: SITE_URL },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bondSchema) }}
      />
      <main className="container mx-auto px-4 py-10 max-w-4xl">
        {breadcrumb}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-mono text-foreground mb-1 tracking-tight">
            {bond.isin_code}
          </h1>
          <p className="text-lg text-muted-foreground">
            {bond.issuer}
            {bond.security_type && (
              <span className="text-base"> · {bond.security_type}</span>
            )}
          </p>
        </div>

        {/* Info card */}
        <section aria-labelledby="temel-bilgiler">
          <h2 id="temel-bilgiler" className="text-lg font-semibold text-foreground mb-3">
            Temel Bilgiler
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <dl className="divide-y divide-border">
              {detailRows.map(({ label, value, mono }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3.5">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd
                    className={`text-sm font-medium text-foreground ${mono ? "font-mono text-xs" : ""}`}
                  >
                    {value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA */}
        <section
          className="mt-8 p-6 rounded-xl bg-muted/30 border border-border"
          aria-labelledby="hesaplama-cta"
        >
          <h2 id="hesaplama-cta" className="text-lg font-semibold text-foreground mb-2">
            Detaylı Hesaplama
          </h2>
          <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
            <strong className="font-mono text-xs text-foreground">{bond.isin_code}</strong> için
            vadeye kadar getiri (YTM), kirli fiyat, birikmiş faiz, durasyon ve spread hesaplamak için
            Bondley&apos;e ücretsiz kayıt olun.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
            >
              Ücretsiz Kayıt Ol
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 border border-border text-foreground px-5 py-2.5 rounded-lg font-medium hover:bg-muted transition-colors text-sm"
            >
              Giriş Yap
            </Link>
          </div>
        </section>

        {/* Back link */}
        <div className="mt-6">
          <Link
            href="/tahvil"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            ← Tüm Tahvillere Dön
          </Link>
        </div>
      </main>
    </>
  );
}
