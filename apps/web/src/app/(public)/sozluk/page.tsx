import Link from "next/link";
import type { Metadata } from "next";

const SITE_URL = "https://bondley.one";

export const metadata: Metadata = {
  title: "Tahvil ve Borçlanma Araçları Sözlüğü",
  description:
    "YTM, kirly fiyat, durasyon, konveksite, TLREF, spread, sukuk — Türkiye tahvil piyasasında kullanılan finansal terimlerin tanımları.",
  keywords: [
    "tahvil terimleri sözlüğü",
    "YTM nedir",
    "kirly fiyat nedir",
    "durasyon nedir",
    "TLREF nedir",
    "spread nedir",
    "borçlanma araçları terimler",
    "finansal sözlük",
  ],
  alternates: { canonical: `${SITE_URL}/sozluk` },
  openGraph: {
    title: "Tahvil Terimleri Sözlüğü | Bondley",
    description:
      "Türkiye tahvil piyasasında kullanılan temel finansal terimlerin kapsamlı sözlüğü.",
    url: `${SITE_URL}/sozluk`,
    type: "website",
  },
};

const terms = [
  {
    term: "Act/Act Gün Sayımı",
    definition:
      "Gerçek/gerçek gün sayımı yöntemi. Birikmiş faiz ve YTM hesaplamalarında kullanılan, yılın gerçek takvim günü sayısını esas alan standarttır. BIST'te devlet tahvilleri için kullanılır.",
  },
  {
    term: "Baz Puan (bp)",
    definition:
      "Faiz oranı değişimlerini ifade etmek için kullanılan ölçü birimi. 1 baz puan = %0,01. Spread ve getiri farklarını ölçmede kullanılır.",
  },
  {
    term: "Birikmiş Faiz (Accrued Interest)",
    definition:
      "Son kupon ödeme tarihinden bugüne kadar biriken ve henüz ödenmeyen faiz tutarı. Tahvil alım-satımında alıcı satıcıya bu tutarı ödeyerek bir sonraki kupon ödemesini tam olarak alır.",
  },
  {
    term: "BIST (Borsa İstanbul)",
    definition:
      "Türkiye'nin tek organize borsa kuruluşu. Hisse senedi, tahvil, bono, kira sertifikası ve diğer finansal araçların işlem gördüğü piyasaları yönetir.",
  },
  {
    term: "Bono",
    definition:
      "Vadesi 1 yıl veya daha kısa olan devlet iç borçlanma senedi. Hazine bonosu olarak da bilinir. Genellikle iskontolu ihraç edilir.",
  },
  {
    term: "Duration (Durasyon)",
    definition:
      "Tahvilin faiz riskini ölçen gösterge. Macaulay durasyonu, nakit akışlarının ağırlıklı ortalama vade süresidir. Modifiye durasyon ise faiz oranındaki 1 puanlık değişimin fiyata etkisini gösterir.",
  },
  {
    term: "Eurobond",
    definition:
      "Yabancı para birimi cinsinden ihraç edilen ve uluslararası piyasalarda işlem gören tahvil. Türkiye'de Hazine ve büyük şirketler tarafından USD veya EUR cinsinden ihraç edilir.",
  },
  {
    term: "Faiz Oranı Riski",
    definition:
      "Piyasa faiz oranlarındaki değişimin tahvil fiyatlarını olumsuz etkileme riski. Faizler yükseldiğinde tahvil fiyatları düşer; bu ilişki durasyon ile ölçülür.",
  },
  {
    term: "Kirli Fiyat (Dirty Price)",
    definition:
      "Birikmiş faiz dahil tahvil fiyatı. Gerçek ödeme tutarını gösterir. Kirli fiyat = Temiz Fiyat + Birikmiş Faiz. Takas ve ödeme işlemlerinde kullanılır.",
  },
  {
    term: "Kira Sertifikası (Sukuk)",
    definition:
      "Faizsiz finans prensiplerine uygun borçlanma aracı. Geleneksel tahvil faiz ödemesi yerine kira geliri dağıtır. Türkiye'de hem devlet hem de özel sektör tarafından ihraç edilmektedir.",
  },
  {
    term: "Konveksite",
    definition:
      "Tahvil fiyatı ile faiz oranı arasındaki ikinci dereceden ilişkiyi ölçen gösterge. Yüksek konveksiteli tahviller, faiz düştüğünde daha fazla değer kazanır ve yükseldiğinde daha az değer kaybeder.",
  },
  {
    term: "Kupon",
    definition:
      "Tahvilin ihraç şartlarında belirlenen ve belirli aralıklarla (3 aylık, 6 aylık, yıllık) ödenen faiz tutarı veya oranı. Sabit ya da TLREF'e endeksli değişken olabilir.",
  },
  {
    term: "Kupon Sıklığı",
    definition:
      "Yıl içinde kaç kez kupon ödemesi yapıldığını belirtir. Türkiye'de 3 aylık (yılda 4), 6 aylık (yılda 2) ve yıllık (yılda 1) sıklıklar yaygındır.",
  },
  {
    term: "Macaulay Durasyonu",
    definition:
      "Tahvilin nakit akışlarının şimdiki değer ağırlıklarıyla hesaplanan ortalama vadesi. Yıl cinsinden ifade edilir ve faiz duyarlılığının temel ölçüsüdür.",
  },
  {
    term: "Modifiye Durasyon",
    definition:
      "Faiz oranındaki 1 puanlık artışa karşı tahvil fiyatında beklenen yüzde değişimi gösteren gösterge. Modifiye Durasyon = Macaulay Durasyonu / (1 + YTM/m).",
  },
  {
    term: "Piyasa Değeri",
    definition:
      "Tahvilin piyasada o an işlem gördüğü fiyat üzerinden hesaplanan toplam değeri. Nominal değerden farklı olabilir.",
  },
  {
    term: "Sabit Getirili Menkul Kıymet",
    definition:
      "Önceden belirlenmiş, değişmeyen faiz ödemeleri (kupon) yapan borçlanma araçları. Tahvil ve bono bu kategoriye girer. Sabit getirili menkul kıymetler, piyasa faizleriyle ters yönlü hareket eder.",
  },
  {
    term: "Spread",
    definition:
      "Bir tahvilin YTM'si ile referans oran (genellikle TLREF) arasındaki fark. Baz puan (bp) cinsinden ifade edilir. Spread, bir menkul kıymetin taşıdığı kredi ve likidite primini yansıtır.",
  },
  {
    term: "Tahvil",
    definition:
      "Devlet veya şirketlerin borçlanmak amacıyla ihraç ettiği, vade sonunda anaparanın geri ödendiği ve ara dönemde kupon faizi ödenen borçlanma aracı. Türkiye'de vadesi 1 yılı aşan devlet borçlanma araçları tahvil olarak adlandırılır.",
  },
  {
    term: "Temiz Fiyat (Clean Price)",
    definition:
      "Birikmiş faiz dahil edilmeden ifade edilen tahvil fiyatı. BIST'te tahvil kotasyonları temiz fiyat üzerinden yapılır.",
  },
  {
    term: "TLREF",
    definition:
      "Türk Lirası Gecelik Referans Faiz Oranı. TCMB tarafından günlük olarak yayımlanan, TL değişken faizli borçlanma araçlarına referans olan endeks. Bondley TLREF verilerini günlük olarak takip eder.",
  },
  {
    term: "Vadeye Kadar Getiri (YTM)",
    definition:
      "Tahvilin bugünkü piyasa fiyatından alınıp vadeye kadar elde tutulması halinde elde edilecek yıllık bileşik getiri oranı. İngilizce: Yield to Maturity (YTM). Farklı tahvilleri karşılaştırmak için en çok kullanılan getiri ölçüsüdür.",
  },
  {
    term: "VDMK (Varlığa Dayalı Menkul Kıymet)",
    definition:
      "Bir varlık havuzunu (kredi, alacak vb.) teminat olarak kullanarak ihraç edilen yapılandırılmış borçlanma aracı. İngilizce karşılığı ABS (Asset-Backed Security).",
  },
  {
    term: "Verim Eğrisi (Yield Curve)",
    definition:
      "Farklı vadeli tahvillerin YTM değerlerini gösteren grafik. Normal verim eğrisinde uzun vadeli tahviller daha yüksek getiri sunar. Düz veya ters eğri ekonomik değerlendirmeler için önemli bir göstergedir.",
  },
];

const sortedTerms = [...terms].sort((a, b) => a.term.localeCompare(b.term, "tr"));

const alphabet = [...new Set(sortedTerms.map((t) => t.term[0].toUpperCase()))].sort((a, b) =>
  a.localeCompare(b, "tr")
);

export default function SozlukPage() {
  const glossarySchema = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Tahvil ve Borçlanma Araçları Sözlüğü",
    description:
      "Türkiye tahvil piyasasında kullanılan finansal terimlerin tanımları",
    url: `${SITE_URL}/sozluk`,
    inLanguage: "tr-TR",
    hasDefinedTerm: sortedTerms.map(({ term, definition }) => ({
      "@type": "DefinedTerm",
      name: term,
      description: definition,
      inDefinedTermSet: `${SITE_URL}/sozluk`,
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Anasayfa", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Sözlük",
        item: `${SITE_URL}/sozluk`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(glossarySchema) }}
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
            <li className="text-foreground font-medium">Sözlük</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
            Tahvil ve Borçlanma Araçları Sözlüğü
          </h1>
          <p className="text-muted-foreground">
            Türkiye tahvil piyasasında kullanılan {sortedTerms.length} temel finansal terimin
            tanımları.
          </p>
        </div>

        {/* Alphabet navigation */}
        <nav className="flex gap-2 flex-wrap mb-8" aria-label="Alfabetik gezinme">
          {alphabet.map((letter) => (
            <a
              key={letter}
              href={`#harf-${letter}`}
              className="text-xs font-mono px-2 py-1 rounded border border-border hover:bg-muted hover:border-primary/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              {letter}
            </a>
          ))}
        </nav>

        {/* Terms by letter */}
        <div className="space-y-10">
          {alphabet.map((letter) => {
            const letterTerms = sortedTerms.filter(
              (t) => t.term[0].toUpperCase() === letter
            );
            return (
              <section key={letter} id={`harf-${letter}`}>
                <h2 className="text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">
                  {letter}
                </h2>
                <dl className="space-y-5">
                  {letterTerms.map(({ term, definition }) => (
                    <div key={term} id={term.toLowerCase().replace(/\s+/g, "-")}>
                      <dt className="text-base font-semibold text-foreground mb-1">{term}</dt>
                      <dd className="text-sm text-muted-foreground leading-relaxed">{definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-12 p-6 rounded-xl bg-muted/30 border border-border text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Terimleri pratikte uygulayın
          </h2>
          <p className="text-muted-foreground text-sm mb-4">
            YTM, durasyon, spread ve tüm bu hesaplamaları canlı tahvil verileriyle yapın.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
          >
            Ücretsiz Başla
          </Link>
        </div>
      </main>
    </>
  );
}
