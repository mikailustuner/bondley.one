import type { Metadata } from "next";

const SITE_URL = "https://bondley.one";
const TITLE = "Bondley – Borçlanma Araçları Değerleme ve Analiz Platformu";
const DESCRIPTION =
  "Türkiye'nin borçlanma araçları analiz platformu. Tahvil, bono, kira sertifikası ve VDMK için BIST piyasa verilerini takip edin. YTM, kirli fiyat, birikmiş faiz, TLREF endeksi ve spread hesaplama. Ücretsiz, gerçek zamanlı.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "tahvil analizi",
    "bono hesaplama",
    "kira sertifikası",
    "VDMK",
    "YTM hesaplama",
    "vadeye kadar getiri",
    "TLREF endeksi",
    "borçlanma araçları",
    "BIST tahvil",
    "Türkiye tahvil piyasası",
    "sabit getirili menkul kıymet",
    "kirli fiyat hesaplama",
    "birikmiş faiz",
    "tahvil değerleme",
    "spread hesaplama",
    "modifiye durasyon",
    "Macaulay durasyon",
    "konveksite",
    "tahvil fiyatlama",
    "tahvil getiri",
  ],
  authors: [{ name: "Bondley", url: SITE_URL }],
  creator: "Bondley",
  publisher: "Bondley",
  category: "finance",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
  },
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: SITE_URL,
    locale: "tr_TR",
    siteName: "Bondley",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Bondley – Borçlanma Araçları Değerleme ve Analiz Platformu" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@bondley",
  },
};

/* ── JSON-LD schemas ── */

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Bondley",
  description: DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  inLanguage: "tr-TR",
  offers: { "@type": "Offer", price: "0", priceCurrency: "TRY" },
  featureList: [
    "Tahvil ve bono YTM hesaplama",
    "TLREF endeksi takibi",
    "Kirli fiyat ve birikmiş faiz hesaplama",
    "Modifiye ve Macaulay durasyon",
    "Spread analizi",
    "Fiyat/getiri geçmiş grafikleri",
    "Favori araç listesi",
    "Vade ve kupon uyarıları",
    "KAP bildirim entegrasyonu",
  ],
  publisher: { "@type": "Organization", name: "Bondley", url: SITE_URL },
  audience: { "@type": "BusinessAudience", audienceType: "Kurumsal yatırımcılar, bireysel yatırımcılar, finansal analistler" },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Bondley",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: "Türkiye borçlanma araçları değerleme ve analiz platformu",
  foundingDate: "2025",
  inLanguage: "tr-TR",
  areaServed: "TR",
  sameAs: [],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Bondley nedir?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Bondley, Türkiye'deki tahvil, bono, kira sertifikası ve VDMK gibi borçlanma araçlarını analiz eden ücretsiz bir web platformudur. BIST piyasa verilerine dayalı olarak YTM, kirli fiyat, birikmiş faiz, durasyon ve spread hesaplamak için kullanılır.",
      },
    },
    {
      "@type": "Question",
      name: "TLREF endeksi nedir?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "TLREF (Türk Lirası Gecelik Referans Faiz Oranı), Türkiye Cumhuriyet Merkez Bankası tarafından yayımlanan ve TL cinsinden değişken faizli borçlanma araçlarına referans olan faiz endeksidir. Bondley, TLREF endeksini günlük olarak takip eder ve değişken faizli tahvillerin fiyatlama hesaplamalarında kullanır.",
      },
    },
    {
      "@type": "Question",
      name: "Tahvil YTM (vadeye kadar getiri) nasıl hesaplanır?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "YTM (Yield to Maturity / Vadeye Kadar Getiri), tahvilin bugünkü piyasa fiyatından satın alınıp vadeye kadar elde tutulması halinde elde edilecek yıllık getiri oranıdır. Bondley, gerçek gün sayımı (Act/Act) kullanarak bisection yöntemiyle doğru YTM hesaplaması yapar.",
      },
    },
    {
      "@type": "Question",
      name: "Kirli fiyat ve temiz fiyat arasındaki fark nedir?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Temiz fiyat (clean price), birikmiş faiz dahil edilmeden hesaplanan tahvil fiyatıdır ve BIST'te kotasyon için kullanılır. Kirli fiyat (dirty price) ise temiz fiyata birikmiş kupon faizinin eklenmesiyle oluşur ve gerçek ödeme tutarını gösterir. Bondley her iki değeri de hesaplar.",
      },
    },
    {
      "@type": "Question",
      name: "Kira sertifikası ve VDMK analizi yapılabilir mi?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Evet. Bondley, BIST'te işlem gören kira sertifikası (sukuk) ve Varlığa Dayalı Menkul Kıymet (VDMK) dahil tüm borçlanma araçlarını kapsar. İhraçcı, vade, getiri tipi ve kupon sıklığına göre filtreleme ve analiz yapılabilir.",
      },
    },
  ],
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      {children}
    </>
  );
}
