import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kullanım Şartları",
  description:
    "Bondley platformunun kullanımına ilişkin temel kurallar, kullanıcı hakları ve sorumlulukları ile hizmet şartları.",
  alternates: { canonical: "https://bondley.one/kullanim-sartlari" },
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-4 py-1.5 text-[12px] font-medium text-muted-foreground mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
            Son Güncelleme: 14 Nisan 2026
          </div>
          <h1 className="text-display-lg text-foreground tracking-tight">
            Kullanım Şartları (Terms of Service)
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-2xl mx-auto">
            Bu belge, <strong className="text-foreground">Bondley</strong> platformunun ("Hizmet", "Platform") kullanımına ilişkin kuralları, haklarınızı ve yükümlülüklerinizi detaylı biçimde düzenlemektedir. Lütfen Platform'u kullanmadan önce bu metni dikkatlice okuyunuz.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-10">

          {/* RESERVATION OF RIGHTS NOTICE */}
          <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-6 mb-12">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <div>
                <p className="text-[15px] font-bold text-amber-700 dark:text-amber-300">
                  ⚠️ YASAL UYARI: DEĞİŞİKLİK VE TEK TARAFLI FESİH HAKKI SAKLIDIR
                </p>
                <p className="text-[13px] text-amber-700/90 dark:text-amber-300/80 mt-2 leading-relaxed">
                  <strong>Bondley</strong> ("Hizmet Sağlayıcı"), işbu Kullanım Şartları'nı, hizmet modellerini, fiyatlandırma politikalarını, API kısıtlamalarını ve sözleşme metinlerini tamamen kendi takdir yetkisi dahilinde, <strong>önceden bildirimde bulunmaksızın değiştirme hakkını münhasıran saklı tutar.</strong> Platformun kullanılmaya devam edilmesi, yapılan değişikliklerin bütünüyle, kayıtsız ve şartsız olarak kabul edildiği anlamına gelir. 
                </p>
              </div>
            </div>
          </div>

          {/* MADDE 1 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 1 – TARAFLAR VE KABUL BEYANI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Bu Kullanım Şartları ("Sözleşme"), <strong className="text-foreground">Bondley</strong> platformunu sunan tüzel kişilik veya temsilci ile Platform'a erişim sağlayan, kullanan veya üye olan gerçek veya tüzel kişi ("Kullanıcı", "Siz", "Müşteri") arasında elektronik ortamda akdedilmiştir.
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Kullanıcı, Platform üzerinde "Kayıt Ol" butonuna tıklayarak veya Platform üzerinden sunulan herhangi bir API'ye veya arayüze erişim sağlayarak işbu Sözleşme'deki tüm maddeleri <strong className="text-foreground">okuduğunu, anladığını, kabul ve taahhüt ettiğini</strong> beyan eder. Kabul etmiyorsanız hizmetlerimizi kullanmayı derhal sonlandırmalısınız.
            </p>
          </article>

          {/* MADDE 2 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 2 – TANIMLAR
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li><strong className="text-foreground">Platform:</strong> Bondley markası altında finansal hesaplama, modelleme ve API hizmetlerinin sunulduğu, web tabanlı, mobil tabanlı ya da programlanabilir tüm sistemlerdir.</li>
              <li><strong className="text-foreground">İçerik:</strong> Modeller, tahminler, tahvil fiyatlamaları, faiz verileri, metinler, grafikler, APİ dökümantasyonu vd. tüm çıktılardır.</li>
              <li><strong className="text-foreground">Kullanıcı:</strong> İşbu Platform'a bir form aracılığıyla kayıt olan tüzel (kurumsal vb.) ve gerçek kişidir.</li>
            </ul>
          </article>

          {/* MADDE 3 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 3 – FİNANSAL VERİ FERAGATNAMESİ (DISCLAIMER)
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform'da yer alan her türlü içerik, hesaplama aracı, tahmin algoritması, fiyatlama modeli, nakit akışı yansımaları, getiriler veya projeksiyonlar; <strong className="text-foreground">TAMAMEN VE SADECE BİLGİLENDİRME</strong> amacıyla sunulmuştur.
            </p>
            <div className="bg-destructive/5 rounded-xl p-4 text-[14px] text-muted-foreground border border-destructive/15">
              <strong className="text-foreground">Yatırım Tavsiyesi Değildir!</strong> Bondley platformundaki hiçbir içerik, araç veya hesaplama; alım satım tavsiyesi, yatırım tavsiyesi, hukuki veya finansal danışmanlık mahiyeti taşımaz. SPK nezdinde yetkilendirilmiş herhangi bir aracı kurum sıfatıyla tavsiyede bulunulmamaktadır.
            </div>
          </article>

          {/* MADDE 4 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 4 – HİZMETLERİN SUNUMU VE YETERLİLİKLERİ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Kullanıcılar platformun sunmuş olduğu hesaplama araçlarını, dashboard arayüzünü ve API gibi temel enstrümanları aşağıdaki kurallar bağlamında kullanır:
            </p>
            <ol className="list-decimal pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Bondley, sağladığı verilerin (kur verisi, tahvil/bono fiyatları vs.) anlık/mükemmel doğruluğunu <strong className="text-foreground">garanti etmez</strong>. Gecikmeli veya yaklaşık değerler sunulabileceğini kullanıcısına bildirir.</li>
              <li>Kullanıcı kaynaklı girilen veri setlerinin (girdilerin) doğruluğu, platformun hesaplama sağlığının tek kıstası olup, hatalı veriden doğacak zararlardan "Hizmet Sağlayıcı" mesul değildir.</li>
            </ol>
          </article>

          {/* MADDE 5 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 5 – KESİNTİLER VE KULLANILABİLİRLİK (SLA VE UPTIME)
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platformumuz <strong className="text-foreground">"olduğu gibi (as-is)" ve "mevcut olduğu şekliyle (as-available)"</strong> prensipleri doğrultusunda sunulmaktadır.
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[14px] text-muted-foreground mb-3">
              <li>Mücbir sebepler (Doğal afetler, altyapı siber saldırıları, ISP kesintileri, sunucu çöküntüleri vb.) bağlamındaki kesintilerden Bondley asgari ve azami ölçüde dahi sorumlu tutulamaz.</li>
              <li>Sunucu planlı ve plansız bakımları nedeniyle platforma giriş veya API çağrılarında kesintiler (downtime) oluşabilir.</li>
            </ul>
          </article>

          {/* MADDE 6 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 6 – ÜYELİK VE HESAP GÜVENLİĞİ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Kullanıcı profil ve erişiminin güvenliği kişiye (Kurumsal ya da Bireysel) tanımlı ve onun sorumluluğundadır:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Kullanıcılar kayıt olurken güncel, kendi adına/şirketine veya sahip olduğu vergi numarasına doğru detaylar girmekle yasal bağlamda hükümlüdür.</li>
              <li><strong className="text-foreground">Şifre Güvenliği:</strong> Veritabanı şifre güvenliğine uygun saklansa dahi, "Şifrenin ifşa edilmesi veya 3. parti kurumla paylaşılması" neticesindeki kayıplar Kullanıcı tarafındadır.</li>
              <li>Hesap aktivitesinde şüpheli veya kural ihlali (spam request) tespit edilen üyelikler, askıya alınabilir veya verileri silinebilir.</li>
            </ol>
          </article>

          {/* MADDE 7 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 7 – API (APPLICATION PROGRAMMING INTERFACE) KULLANIMI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Premium abonelerimiz veya Kurumsal anlaşma sağlanan kullanıcılarımıza tahsis edilen API altyapısı kullanırken:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li><strong className="text-foreground">Oran Kısıtlamaları (Rate-Limiting):</strong> Birim zamanda veya ayrılmış kontrattaki limitin dışına çıkan istekler "429 Too Many Requests" alacak ve limitlenir. API'yi istismar etmek (DDoS/Spam), IP ban veya üyelik lisansının bitirilmesi (Termination) sebebidir.</li>
              <li>API Key veya Token'ların istemcide değil backend tarafında saklanması Kullanıcının ana sorumluluğudur. Anahtarın yetkisiz kişilerce çalınması halinde Bondley mesul değildir.</li>
            </ul>
          </article>

          {/* MADDE 8 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 8 – GERİ ÖDEME (REFUND) VE ABONELİK ŞARTLARI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              SaaS (Software As A Service - Hizmet olarak yazılım) altyapısında sunulan model için <strong className="text-foreground">cayma hakkı ve ödeme iptalleri</strong> bağlamındaki şartlar şöyledir:
            </p>
            <div className="bg-muted/30 rounded-xl p-4 text-[14px] text-muted-foreground">
              <strong className="text-foreground">Tüzel (Şirket) Üyelikler:</strong> Platform, dijital anlık içerik sağlayan yapıda ve genel anlamda kurumsal / B2B ticarete (Ticaret Kanunu m.18) girdiğinden "Şartsız cayma iadesi veya geri ödeme" yapılmayabilir. Kullanıcı üyeliğini platform üzerinden "Aboneliği İptal Et" diyerek sonraki aylara devretmeyip feshedebilir. Ödenmiş devir için iade yapılmaz, tahsis edilen kalan hak süre bitene kadar kullanılır.
            </div>
          </article>

          {/* MADDE 9 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 9 – FİKRİ MÜLKİYET HAKLARI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              "Bondley" markası, platform unvanı, alan adları, arayüz tasarımları, yazılım algoritması, tahvil hesaplama logikleri (arka plan kodları), ikonlar, modellemeler, ve logolar ulusal ve uluslararası Telif Hakları, Fikrî ve Sinai Mülkiyet kanunları dahilinde korunmaktadır.
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Hizmetlerimiz üzerinden <strong className="text-foreground">Tersine mühendislik (reverse engineering), veri kazıma/kopyalama (scraping), kod bloklarının izinsiz türetilmesi veya platformdaki materyalin kopyalanarak kendi ticari kazancına yönelik kullanılması</strong> açık ve mutlak bir sözleşme ihlali ile doğrudan yasal süreçlere konu eylemdir.
            </p>
          </article>

          {/* MADDE 10 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 10 – PLATFORMUN KÖTÜYE KULLANIMI: YASAKLI YÖNTEMLER
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Kullanıcılar aşağıdaki sayılan, ancak bunlarla kısıtlı olmayan şekillerde sistemi ihlal edemezler:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Hesap şifresi veya API anahtarlarını karaborsada satmak veya çoklu kullanıcıların giriş yapmasını sağlamak (hesap paylaşımı yasaktır ve hesap tespit edilip banlanır).</li>
              <li>Platformun SQL Enjeksiyonu, XSS, DDOS, Botnet üzerinden açığını aramaya çalışmak, zaafı sömürmek ve veritabanı akışına zarar vermek.</li>
              <li>Mevzuata, etik/ahlak dışı ve finansal kanunlara aykırı manipülasyon (Piyasa Bozucu) senaryolarına yönelik kâr argümanları kurgulamak.</li>
            </ol>
          </article>

          {/* MADDE 11 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 11 – 3. PARTİ VERİ/SİTE BAĞLANTILARI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Bondley platformu zaman zaman güncel finans haberlerini veya dış veri linklerini (Merkez Bankası verileri vb.) size sağlayabilir. Harici ("out-of-platform") websitelere yaptığınız yönlendirmelerde, veri çeken iframe/API bloklarında o firmaların/sitelerin yasal koşulları ve gizliliği geçerli olup, <strong className="text-foreground">Bondley yönlendirilen sitedeki oluşacak mağduriyetlerden katiyen mesul tutulamaz.</strong>
            </p>
          </article>

          {/* MADDE 12 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 12 – VERİ GİZLİLİĞİ VE İŞLENMESİ (KVKK & GDPR)
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Sözleşmenin tüm tarafları, "Gizlilik ve Çerez Politikası" metnine yasal olarak bağımlı durumdadır. Kullanıcının işlenmesine izin verdiği veriler sadece Politika kuralları, Kişisel Verileri Koruma Kanun (KVKK) / GDPR ve ticari hizmet metinleri bağlamında yürütülür.
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Detayları okumak için lütfen <Link href="/gizlilik" className="text-primary hover:underline">Gizlilik ve Çerez Politikası</Link> sayfamızı ziyaret ediniz.
            </p>
          </article>

          {/* MADDE 13 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 13 – SINIRLI SORUMLULUK (LIMITATION OF LIABILITY)
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Kanunun azami müsaade ettiği ölçüde, Platform, bağlı ortakları, servis yöneticileri veya geliştiricileri; <strong>KAR KAYBI, GELİR KAYBI, KULLANIM KAYBI, İTİBAR ZEDELENMESİ VEYA VERİ KAYBI</strong> gibi hiçbir doğrudan, dolaylı, kasıtsız, cezai, ve özel zarardan ötürü, sözleşmenin (Kullanım Şartları) bir sonucu veya bir ihlali sebebiyle meydana gelmesi ve oluşması bağlamında sorumlu bulunmayacaktır. Toplam üstlendiği miktar, ancak sadece son kullanıcının geriye dönük platforma ödediği veya son 2 fatura bedeli (hangisi daha düşük tutarsa) limitlidir.
            </p>
          </article>

          {/* MADDE 14 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 14 – SÖZLEŞMENİN FESHİ (TERMINATION)
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              İşbu hizmet akiti ve sözleşme, her iki tarafça süresi belli olmayan metin düzeyindedir.
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Kullanıcı dilediğinde platformu terkederek (Abonelik varsa iptal ederek) sözleşmeyi (geçmiş yasal saklama/ihtilaf maddeleri dışında) sonlandırabilir.</li>
              <li><strong className="text-foreground">Bondley, herhangi bir bildirim yapmaksızın:</strong> Kötü niyet, kural ihlali veya sisteme zarar saptadığı kullanıcıyı derhal durdurabilir, hesaba erisimi kalıcı şekilde feshedebilir (terminate) ve ilgili durumu adli kolluk organlarına bildirerek yargı süreci başlatabilir.</li>
            </ol>
          </article>

          {/* MADDE 15 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 15 – BÖLÜNEBİLİRLİK (SEVERABILITY)
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              İşbu Kullanım Şartlarının herhangi bir maddesi veya spesifik alt bendi, Yetkili Türk Mahkemeleri bünyesinde ve karara binaen kısmı "Kanuna Aykırı/Geçersiz" beyan edilip askıya alınsa veya iptal edilse dahi, <strong className="text-foreground">diğer kalan maddeler, tüm taraflar için hükmünü, devamlılığını ve geçerliliğini korumaya devam edecektir</strong>.
            </p>
          </article>

          {/* MADDE 16 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 16 – UYGULANACAK HUKUK VE YETKİLİ MAHKEMELER
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              İşbu sözleşme maddelerinden veya direkt kullanım detaylarından doğacak olan uyuşmazlıklarda <strong className="text-foreground">Aksine iddia ileri sürülemeyecek şekilde "Türkiye Cumhuriyeti Yasaları" ve "Medeni Kanunları ile Borçlar/Ticaret Yasası"</strong> tatbik edilecektir.
            </p>
            <div className="bg-primary/5 rounded-xl p-4 text-[14px] text-muted-foreground border border-primary/10">
              Olabilecek her nevi, maddi, ticari ve cezai ihtilafta veya veri gizlilik davasında, Münhasıran (diğer tüm ihtimalleri dışlayarak) <strong className="text-foreground">İstanbul (Merkez) Mahkemeleri ve İstanbul İcra Müdürlükleri kesin Yetkilidir</strong>. (Şirketin bulunduğu bölge bağlamında, yargı çevresindeki Tüketici/Asliye Ticaret ve Sulh Makamları yetkili addedilmiştir).
            </div>
          </article>


          {/* Footer Info */}
          <div className="mt-12 pt-8 border-t border-border/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[13px] text-muted-foreground">
              <p>
                İletişime geçmek için iletişim kutumuzu kullanabilir veya yasal sorularınızı <strong className="text-foreground">noreply@bondley.one</strong> tarafına iletebilirsiniz. 
                <br />
                Bu politika <strong className="text-foreground">16 madde</strong> halinde düzenlenmiş olup, itiraz edilmeksizin yürürlüğe alınmıştır.
              </p>
              <Link
                href="/"
                className="text-primary hover:text-primary/80 font-medium transition-colors no-underline"
              >
                ← Ana Sayfaya Dön
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
