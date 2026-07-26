import Link from "next/link";
import type { Metadata } from "next";

const SITE_URL = "https://bondley.one";

export const metadata: Metadata = {
  title: "Sıkça Sorulan Sorular",
  description:
    "TLREF nedir, YTM nasıl hesaplanır, kirly fiyat ne demek, kira sertifikası analizi nasıl yapılır — Bondley hakkında merak edilenler.",
  keywords: [
    "TLREF nedir",
    "YTM nedir",
    "vadeye kadar getiri hesaplama",
    "kirly fiyat nedir",
    "tahvil analizi soru cevap",
    "borçlanma araçları sss",
    "spread nedir tahvil",
  ],
  alternates: { canonical: `${SITE_URL}/sss` },
  openGraph: {
    title: "Sıkça Sorulan Sorular | Bondley",
    description:
      "Tahvil analizi, TLREF endeksi ve YTM hesaplama hakkında sık sorulan sorular ve yanıtları.",
    url: `${SITE_URL}/sss`,
    type: "website",
  },
};

const faqs = [
  {
    question: "Bondley nedir?",
    answer:
      "Bondley, Türkiye'deki tahvil, bono, kira sertifikası ve VDMK gibi borçlanma araçlarını analiz eden ücretsiz bir web platformudur. BIST piyasa verilerine dayalı olarak YTM, kirly fiyat, birikmiş faiz, durasyon ve spread hesaplamak için kullanılır.",
  },
  {
    question: "TLREF endeksi nedir?",
    answer:
      "TLREF (Türk Lirası Gecelik Referans Faiz Oranı), Türkiye Cumhuriyet Merkez Bankası tarafından yayımlanan ve TL cinsinden değişken faizli borçlanma araçlarına referans olan faiz endeksidir. Bondley, TLREF endeksini günlük olarak takip eder ve değişken faizli tahvillerin fiyatlama hesaplamalarında kullanır.",
  },
  {
    question: "YTM (vadeye kadar getiri) nedir ve nasıl hesaplanır?",
    answer:
      "YTM (Yield to Maturity / Vadeye Kadar Getiri), tahvilin bugünkü piyasa fiyatından satın alınıp vadeye kadar elde tutulması halinde elde edilecek yıllık getiri oranıdır. Bondley, gerçek gün sayımı (Act/Act) kullanarak bisection yöntemiyle doğru YTM hesaplaması yapar.",
  },
  {
    question: "Kirli fiyat ve temiz fiyat arasındaki fark nedir?",
    answer:
      "Temiz fiyat (clean price), birikmiş faiz dahil edilmeden hesaplanan tahvil fiyatıdır ve BIST'te kotasyon için kullanılır. Kirli fiyat (dirty price) ise temiz fiyata birikmiş kupon faizinin eklenmesiyle oluşur ve gerçek ödeme tutarını gösterir. Bondley her iki değeri de hesaplar.",
  },
  {
    question: "Birikmiş faiz nedir?",
    answer:
      "Birikmiş faiz, son kupon ödeme tarihinden bugüne kadar biriken ve henüz ödenmeyen faiz tutarıdır. Tahvil alıcısı bu tutarı tahvil satıcısına öder; bir sonraki kupon ödemesinde tamamını geri alır. Bondley birikmiş faizi gerçek gün sayımına göre hesaplar.",
  },
  {
    question: "Spread nedir ve nasıl hesaplanır?",
    answer:
      "Spread, teorik yıllık getiri ile ilgili referans oran arasındaki farktır. Bondley kıymetleri karşılaştırılabilir kılmak için temiz fiyatı nominal 100 varsayarak otomatik değerler; bu bir piyasa kotasyonu veya anlık piyasa getirisi iddiası değildir. TRD ile başlayan katılım kıymetlerinde referans TLREFK'dir.",
  },
  {
    question: "Modifiye durasyon ve Macaulay durasyon nedir?",
    answer:
      "Macaulay durasyon, tahvilin nakit akışlarının ağırlıklı ortalama vadesidir ve faiz duyarlılığının temel ölçüsüdür. Modifiye durasyon ise Macaulay durasyonun (1 + YTM/m) değerine bölünmesiyle elde edilir; faiz oranındaki 1 puanlık değişime karşı fiyat değişimini yüzde olarak gösterir.",
  },
  {
    question: "Kira sertifikası (sukuk) ve VDMK analizi yapılabilir mi?",
    answer:
      "Evet. Bondley, BIST'te işlem gören kira sertifikası (sukuk) ve Varlığa Dayalı Menkul Kıymet (VDMK) dahil tüm borçlanma araçlarını kapsar. İhraçcı, vade, getiri tipi ve kupon sıklığına göre filtreleme ve analiz yapılabilir.",
  },
  {
    question: "Değişken faizli tahvil hesaplaması nasıl yapılır?",
    answer:
      "Değişken faizli (floating rate) tahviller için kupon ödemeleri TLREF endeksine dayalıdır. Bondley, güncel TLREF oranını referans alarak bir sonraki kupon ödemesini tahmin eder ve bu değeri YTM hesaplamasına dahil eder.",
  },
  {
    question: "Konveksite nedir?",
    answer:
      "Konveksite, tahvil fiyatı ile faiz oranı arasındaki doğrusal olmayan ilişkiyi ölçer. Modifiye durasyonun faiz değişimlerine verdiği ikinci dereceden düzeltmeyi temsil eder. Yüksek konveksiteye sahip tahviller, faiz düştüğünde daha fazla değer kazanır ve faiz yükseldiğinde daha az değer kaybeder.",
  },
  {
    question: "Bondley hangi verileri kullanıyor?",
    answer:
      "Bondley, BIST (Borsa İstanbul) tarafından yayımlanan güncel borçlanma araçları verilerini ve TCMB TLREF endeks verilerini kullanır. Veriler her gün otomatik olarak güncellenir. Hesaplamalar ve analizler Bondley'in kendi finansal motoru tarafından gerçekleştirilir.",
  },
  {
    question: "Bondley ücretsiz mi?",
    answer:
      "Evet, Bondley temel analiz özellikleri için tamamen ücretsizdir. Kayıt olmak ve tahvil analizine başlamak için herhangi bir ödeme gerekmez.",
  },
];

export default function SSSPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Anasayfa", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Sıkça Sorulan Sorular", item: `${SITE_URL}/sss` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main className="container mx-auto px-4 py-10 max-w-4xl">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 flex-wrap">
            <li>
              <Link href="/landing" className="hover:text-foreground transition-colors">
                Anasayfa
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium">Sıkça Sorulan Sorular</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
            Sıkça Sorulan Sorular
          </h1>
          <p className="text-muted-foreground">
            Bondley ve Türkiye tahvil piyasası hakkında merak edilenler.
          </p>
        </div>

        {/* FAQ list */}
        <div className="space-y-0 divide-y divide-border border border-border rounded-xl overflow-hidden">
          {faqs.map(({ question, answer }, i) => (
            <article key={i} className="px-6 py-5">
              <h2 className="text-base font-semibold text-foreground mb-2">{question}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
            </article>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 p-6 rounded-xl bg-muted/30 border border-border text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">Hâlâ sorunuz mu var?</h2>
          <p className="text-muted-foreground text-sm mb-4">
            İletişim formumuzdan bize ulaşabilirsiniz.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/iletisim"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
            >
              İletişime Geç
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 border border-border text-foreground px-5 py-2.5 rounded-lg font-medium hover:bg-muted transition-colors text-sm"
            >
              Ücretsiz Kayıt Ol
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
