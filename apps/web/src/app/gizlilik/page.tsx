import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik ve Çerez Politikası",
  description:
    "Bondley gizlilik politikası, kişisel verilerin korunması, çerez kullanımı ve KVKK uyumluluğu hakkında detaylı bilgi.",
  alternates: { canonical: "https://bondley.one/gizlilik" },
};

export default function PrivacyPolicyPage() {
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
            Gizlilik ve Çerez Politikası
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-2xl mx-auto">
            Bu gizlilik politikası, <strong className="text-foreground">Bondley</strong> platformu tarafından kişisel verilerinizin nasıl toplandığını,
            işlendiğini, saklandığını ve korunduğunu ayrıntılı biçimde açıklamaktadır. Platformumuzu
            kullanarak aşağıda belirtilen koşulları kabul etmiş sayılırsınız.
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
                  ⚠️ ÖNEMLİ UYARI – DEĞİŞİKLİK HAKKI SAKLI
                </p>
                <p className="text-[13px] text-amber-700/90 dark:text-amber-300/80 mt-2 leading-relaxed">
                  <strong>Bondley</strong> (&quot;Hizmet Verici Kurum&quot;), işbu Gizlilik ve Çerez Politikası&apos;nı <strong>herhangi bir zamanda</strong>, herhangi bir gerekçe göstermeksizin, <strong>önceden bildirimde bulunmaksızın</strong> veya bulunarak, tamamen kendi takdir yetkisi dahilinde, kısmen veya bütünüyle <strong>değiştirme, güncelleme, kaldırma veya yeniden düzenleme hakkını münhasıran ve kayıtsız şartsız olarak saklı tutar</strong>. Değişikliklerin yürürlük tarihi, platformda ilan edildiği andır. Kullanıcıların güncel politikayı düzenli olarak kontrol etmeleri <strong>kendi sorumluluklarındadır</strong>. Platformun kullanılmaya devam edilmesi, güncellenen politikanın bütünüyle kabul edildiği anlamına gelir.
                </p>
              </div>
            </div>
          </div>

          {/* MADDE 1 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 1 – TANIMLAR VE KAPSAM
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              İşbu <strong className="text-foreground">Gizlilik ve Çerez Politikası</strong> (&quot;Politika&quot;), <strong className="text-foreground">Bondley</strong> ticari unvanı altında faaliyet gösteren borçlanma araçları değerleme ve analiz platformu (&quot;Platform&quot;, &quot;Hizmet&quot;, &quot;Bondley&quot;, &quot;Biz&quot;, &quot;Bizim&quot;) ile Platform&apos;u kullanan tüm gerçek ve tüzel kişiler (&quot;Kullanıcı&quot;, &quot;Siz&quot;, &quot;Sizin&quot;, &quot;Üye&quot;, &quot;Ziyaretçi&quot;) arasındaki kişisel verilerin işlenmesine ilişkin hüküm ve koşulları düzenler.
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Bu Politika, aşağıdaki mevzuat ile uyumlu olarak hazırlanmıştır:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[14px] text-muted-foreground mb-3">
              <li><strong className="text-foreground">6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK)</strong></li>
              <li><strong className="text-foreground">Avrupa Birliği Genel Veri Koruma Tüzüğü (GDPR)</strong></li>
              <li><strong className="text-foreground">Elektronik Ticaretin Düzenlenmesi Hakkında Kanun</strong> ve ilgili ikincil mevzuat</li>
            </ul>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Kişisel veri</strong>, kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgiyi ifade eder. Bu tanım kapsamında; ad, soyad, elektronik posta adresi, IP adresi, çerez tanımlayıcıları, cihaz parmak izi (<em>device fingerprint</em>), coğrafi konum verileri, kullanım geçmişi, tercih verileri, erişim logları, tarayıcı bilgileri, işletim sistemi türü ve sürümü, ekran çözünürlüğü ile benzeri tüm veriler <strong className="text-foreground">kişisel veri</strong> olarak kabul edilir ve işbu Politika kapsamında korunur.
            </p>
          </article>

          {/* MADDE 2 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 2 – VERİ SORUMLUSU BİLGİLERİ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">KVKK&apos;nın 10. maddesi</strong> gereğince veri sorumlusunun aydınlatma yükümlülüğü kapsamında: <strong className="text-foreground">Bondley</strong> platformunun veri sorumlusu sıfatıyla hareket eden tüzel kişiliğidir. Veri sorumlusuna ilişkin iletişim bilgileri, Platform&apos;un &quot;İletişim&quot; sayfasında yer almakta olup, kişisel verilerinize ilişkin tüm başvurularınızı buradan iletebilirsiniz.
            </p>
          </article>

          {/* MADDE 3 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 3 – TOPLANAN KİŞİSEL VERİLER
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-4">
              Platform tarafından toplanan kişisel veriler aşağıda sınıflandırılmıştır. Her bir veri kategorisi, <strong className="text-foreground">işlenme amacı ve hukuki dayanağı</strong> ile birlikte değerlendirilmelidir:
            </p>

            <h3 className="text-[16px] font-semibold text-foreground mt-6 mb-2">3.1 – Kimlik Verileri</h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-2">
              Ad, soyad, kullanıcı adı, hesap numarası, e-posta adresi, şifre hash&apos;i (kriptografik olarak şifrelenmiş parola).
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[14px] text-muted-foreground mb-4">
              <li><strong className="text-foreground">Amaç:</strong> Hesap oluşturma, kimlik doğrulama ve hesap güvenliğinin sağlanması</li>
              <li><strong className="text-foreground">Hukuki dayanak:</strong> Sözleşmenin ifası, meşru menfaat</li>
            </ul>

            <h3 className="text-[16px] font-semibold text-foreground mt-6 mb-2">3.2 – İletişim Verileri</h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-2">
              Elektronik posta adresi, kurumsal telefon numarası <em>(opsiyonel)</em>, şirket adresi bilgisi, konum bilgisi <em>(il/ilçe düzeyinde)</em>.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[14px] text-muted-foreground mb-4">
              <li><strong className="text-foreground">Amaç:</strong> Kullanıcı ile iletişim, destek talepleri, yasal bildirimler</li>
              <li><strong className="text-foreground">Hukuki dayanak:</strong> Sözleşmenin ifası, yasal yükümlülük</li>
            </ul>

            <h3 className="text-[16px] font-semibold text-foreground mt-6 mb-2">3.3 – Kurumsal ve Mesleki Veriler</h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-2">
              Şirket/kurum adı, departman, unvan, faaliyet alanı, tahmini günlük kullanım hacmi, kullanım amacı.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[14px] text-muted-foreground mb-4">
              <li><strong className="text-foreground">Amaç:</strong> B2B hizmet düzeyinin belirlenmesi, kullanıcı segmentasyonu, ürün geliştirme</li>
              <li><strong className="text-foreground">Hukuki dayanak:</strong> Meşru menfaat, sözleşmenin ifası</li>
            </ul>

            <h3 className="text-[16px] font-semibold text-foreground mt-6 mb-2">3.4 – Teknik ve Erişim Verileri</h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-2">
              IP adresi <em>(IPv4 ve IPv6)</em>, tarayıcı türü ve sürümü, işletim sistemi, cihaz türü, ekran çözünürlüğü, dil tercihi, saat dilimi, erişim zamanları, oturum süresi, sayfa görüntüleme verileri, tıklama verileri, kaydırma derinliği, referans URL&apos;si, çıkış URL&apos;si.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[14px] text-muted-foreground mb-4">
              <li><strong className="text-foreground">Amaç:</strong> Sistem güvenliği, performans optimizasyonu, hata tespiti, kullanıcı deneyiminin iyileştirilmesi</li>
              <li><strong className="text-foreground">Hukuki dayanak:</strong> Meşru menfaat</li>
              <li><strong className="text-foreground">Toplama yöntemi:</strong> Otomatik</li>
            </ul>

            <h3 className="text-[16px] font-semibold text-foreground mt-6 mb-2">3.5 – İşlem ve Kullanım Verileri</h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-2">
              Görüntülenen tahvil/bono ISIN kodları, yapılan hesaplama detayları, filtreleme ve sıralama tercihleri, favorilere eklenen enstrümanlar, indirilen raporlar, API çağrı logları, kullanım sıklığı ve desen verileri.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[14px] text-muted-foreground mb-4">
              <li><strong className="text-foreground">Amaç:</strong> Hizmetin sunulması, kişiselleştirme, istatistiksel analiz</li>
              <li><strong className="text-foreground">Hukuki dayanak:</strong> Sözleşmenin ifası, meşru menfaat</li>
            </ul>

            <h3 className="text-[16px] font-semibold text-foreground mt-6 mb-2">3.6 – Güvenlik Verileri</h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-2">
              İki faktörlü kimlik doğrulama <em>(2FA/MFA)</em> kayıtları, oturum açma/kapama logları, başarısız giriş denemeleri, şüpheli aktivite kayıtları, cihaz parmak izi hashleri.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[14px] text-muted-foreground">
              <li><strong className="text-foreground">Amaç:</strong> Hesap güvenliğinin sağlanması, yetkisiz erişimin önlenmesi</li>
              <li><strong className="text-foreground">Hukuki dayanak:</strong> Meşru menfaat, yasal yükümlülük</li>
            </ul>
          </article>

          {/* MADDE 4 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 4 – KİŞİSEL VERİLERİN TOPLANMA YÖNTEMLERİ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Kişisel verileriniz aşağıdaki yöntemler ile <strong className="text-foreground">otomatik ve otomatik olmayan</strong> yollarla toplanmaktadır:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-[14px] text-muted-foreground">
              <li>Platform üzerindeki <strong className="text-foreground">kayıt ve üyelik formları</strong> aracılığıyla doğrudan sizden</li>
              <li>Platform kullanımınız sırasında <strong className="text-foreground">çerezler, piksel etiketleri, web işaretçileri</strong> ve benzeri izleme teknolojileri vasıtasıyla otomatik olarak</li>
              <li>Üçüncü taraf analiz hizmetleri (<strong className="text-foreground">Google Analytics, Sentry</strong> hata izleme vb.) aracılığıyla</li>
              <li><strong className="text-foreground">E-posta iletişimleri</strong> yoluyla</li>
              <li>Müşteri destek talepleri ve <strong className="text-foreground">geri bildirim formları</strong> aracılığıyla</li>
              <li><strong className="text-foreground">API entegrasyonları</strong> üzerinden</li>
              <li><strong className="text-foreground">Sunucu erişim logları</strong> aracılığıyla otomatik olarak</li>
            </ol>
            <p className="text-[14px] leading-relaxed text-muted-foreground mt-3">
              Tüm toplama yöntemleri için <strong className="text-foreground">KVKK&apos;nın 5. ve 6. maddelerinde</strong> belirlenen hukuki dayanaklar esas alınır.
            </p>
          </article>

          {/* MADDE 5 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 5 – KİŞİSEL VERİLERİN İŞLENME AMAÇLARI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Toplanan kişisel veriler, aşağıda sıralanan amaçlarla <strong className="text-foreground">sınırlı olmak üzere</strong> işlenmektedir:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Platform üyelik süreçlerinin yürütülmesi ve <strong className="text-foreground">hesap yönetimi</strong></li>
              <li><strong className="text-foreground">Borçlanma araçları değerleme</strong>, fiyat hesaplama ve analiz hizmetlerinin sunulması</li>
              <li>Kullanıcı <strong className="text-foreground">kimlik doğrulama ve yetkilendirme</strong> süreçlerinin yönetimi</li>
              <li>Platform güvenliğinin sağlanması ve <strong className="text-foreground">yetkisiz erişimin engellenmesi</strong></li>
              <li><strong className="text-foreground">Yasal yükümlülüklerin</strong> yerine getirilmesi</li>
              <li>Müşteri destek hizmetlerinin sunulması</li>
              <li>Hizmet kalitesinin ölçülmesi ve iyileştirilmesi</li>
              <li><strong className="text-foreground">İstatistiksel analizlerin</strong> yapılması</li>
              <li>Kullanıcı deneyiminin <strong className="text-foreground">kişiselleştirilmesi</strong></li>
              <li>Pazarlama iletişimlerinin gönderilmesi <em>(ayrıca onay alınması kaydıyla)</em></li>
              <li>Yasal uyuşmazlıklarda <strong className="text-foreground">delil teşkil etmesi</strong></li>
              <li>Düzenleyici kurumlara raporlama yükümlülüklerinin yerine getirilmesi</li>
              <li>Kurumsal <strong className="text-foreground">risk yönetimi</strong> ve iç denetim süreçleri</li>
              <li><strong className="text-foreground">B2B sözleşme</strong> yükümlülüklerinin ifası</li>
              <li>Platform altyapısının bakım ve geliştirme süreçleri</li>
            </ol>
          </article>

          {/* MADDE 6 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 6 – KİŞİSEL VERİLERİN İŞLENMESİNİN HUKUKİ DAYANAĞI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Kişisel verileriniz, <strong className="text-foreground">KVKK&apos;nın 5. maddesinin 2. fıkrasında</strong> belirlenen aşağıdaki hukuki dayanaklara istinaden işlenmektedir:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li><strong className="text-foreground">Kanunlarda açıkça öngörülmesi</strong></li>
              <li>Fiili imkansızlık nedeniyle rızasını açıklayamayacak durumda bulunan kişinin hayatı veya beden bütünlüğünün korunması için <strong className="text-foreground">zorunlu olması</strong></li>
              <li>Bir <strong className="text-foreground">sözleşmenin kurulması veya ifasıyla</strong> doğrudan ilgili olması kaydıyla veri işlemenin gerekli olması</li>
              <li>Veri sorumlusunun <strong className="text-foreground">hukuki yükümlülüğünü</strong> yerine getirebilmesi için zorunlu olması</li>
              <li>İlgili kişinin kendisi tarafından <strong className="text-foreground">alenileştirilmiş</strong> olması</li>
              <li>Bir <strong className="text-foreground">hakkın tesisi, kullanılması veya korunması</strong> için zorunlu olması</li>
              <li>İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla, veri sorumlusunun <strong className="text-foreground">meşru menfaatleri</strong> için zorunlu olması</li>
            </ol>
            <p className="text-[14px] leading-relaxed text-muted-foreground mt-3">
              Ayrıca, <strong className="text-foreground">GDPR kapsamında Madde 6(1)(a) ila 6(1)(f)</strong> hükümleri de ek hukuki dayanak olarak değerlendirilmektedir.
            </p>
          </article>

          {/* MADDE 7 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 7 – ÇEREZ (COOKIE) POLİTİKASI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-4">
              Platform, kullanıcı deneyimini iyileştirmek, hizmetlerin düzgün çalışmasını sağlamak ve istatistiksel veriler toplamak amacıyla çeşitli <strong className="text-foreground">çerez türleri</strong> kullanmaktadır. <strong className="text-foreground">Çerez</strong>, web tarayıcınız aracılığıyla cihazınıza yerleştirilen küçük metin dosyalarıdır.
            </p>

            <h3 className="text-[16px] font-semibold text-foreground mt-6 mb-2">🟢 7.1 – Zorunlu (Temel) Çerezler</h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-2">
              Bu çerezler, Platform&apos;un temel işlevlerinin çalışması için <strong className="text-foreground">mutlak surette gereklidir</strong> ve devre dışı bırakılamaz.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[14px] text-muted-foreground mb-4">
              <li><strong className="text-foreground">İşlevler:</strong> Oturum yönetimi, güvenlik doğrulaması, yük dengeleme, kullanıcı tercih hafızası (dil, tema)</li>
              <li><strong className="text-foreground">Yasal dayanak:</strong> KVKK madde 5/2(c) – sözleşmenin ifası; ePrivacy Directive madde 5(3)</li>
              <li><strong className="text-foreground">Saklama süresi:</strong> Oturum bazlı veya en fazla 13 ay</li>
            </ul>

            <h3 className="text-[16px] font-semibold text-foreground mt-6 mb-2">🔵 7.2 – Analiz ve Performans Çerezleri</h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-2">
              Platform&apos;un kullanım istatistiklerini anonim olarak toplamak, sayfa yüklenme sürelerini ölçmek ve teknik hataları tespit etmek amacıyla kullanılır. <strong className="text-foreground">Yalnızca kullanıcının açık rızası ile</strong> etkinleştirilir.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[14px] text-muted-foreground mb-4">
              <li><strong className="text-foreground">Kullanılan araçlar:</strong> Google Analytics 4, Sentry performans izleme</li>
              <li><strong className="text-foreground">Yasal dayanak:</strong> Açık rıza (KVKK madde 5/1; GDPR madde 6/1(a))</li>
              <li><strong className="text-foreground">Saklama süresi:</strong> En fazla 26 ay</li>
            </ul>

            <h3 className="text-[16px] font-semibold text-foreground mt-6 mb-2">🟠 7.3 – Pazarlama ve Hedefleme Çerezleri</h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-2">
              Kişiselleştirilmiş içerik ve reklamlar sunmak, kampanya etkinliğini ölçmek ve kullanıcı segmentasyonu yapmak amaçlıdır. <strong className="text-foreground">Yalnızca kullanıcının açık rızası ile</strong> etkinleştirilir.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[14px] text-muted-foreground mb-4">
              <li><strong className="text-foreground">Yasal dayanak:</strong> Açık rıza (KVKK madde 5/1; GDPR madde 6/1(a))</li>
              <li><strong className="text-foreground">Saklama süresi:</strong> En fazla 13 ay</li>
            </ul>

            <h3 className="text-[16px] font-semibold text-foreground mt-6 mb-2">⚙️ 7.4 – Çerez Yönetimi</h3>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Kullanıcılar, Platform&apos;a ilk erişimlerinde gösterilen <strong className="text-foreground">çerez izin barı</strong> aracılığıyla tercihlerini belirleyebilir. Tercihler her zaman tarayıcı ayarlarından veya Platform&apos;un çerez ayarları bölümünden güncellenebilir. <strong className="text-foreground">Zorunlu çerezler haricindeki tüm çerezler</strong>, kullanıcının açık rızası olmaksızın etkinleştirilmez.
            </p>
          </article>

          {/* MADDE 8 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 8 – KİŞİSEL VERİLERİN AKTARIMI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Kişisel verileriniz, aşağıda belirtilen taraflarla, <strong className="text-foreground">yalnızca belirtilen amaçlar ve hukuki dayanaklar</strong> doğrultusunda paylaşılabilir:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Yasal zorunluluk halinde <strong className="text-foreground">yetkili kamu kurum ve kuruluşları</strong> (mahkemeler, savcılıklar, düzenleyici otoriteler, KVKK Kurulu)</li>
              <li>Hizmet altyapısının sağlanması amacıyla <strong className="text-foreground">bulut bilişim hizmet sağlayıcıları</strong> (sunucu barındırma, CDN hizmetleri)</li>
              <li><strong className="text-foreground">E-posta gönderim</strong> hizmetleri sağlayıcıları</li>
              <li>Ödeme işleme hizmetleri sağlayıcıları</li>
              <li>Hata izleme ve performans analiz hizmetleri (<strong className="text-foreground">Sentry</strong>)</li>
              <li>İstatistiksel analiz hizmetleri</li>
              <li>Hukuk müşavirleri ve bağımsız denetim kuruluşları</li>
            </ol>
            <p className="text-[14px] leading-relaxed text-muted-foreground mt-3">
              Her bir veri aktarımında <strong className="text-foreground">KVKK&apos;nın 8. ve 9. maddelerinde</strong> düzenlenen koşullara uyulur. Yurt dışına veri aktarımı halinde, aktarım yapılan ülkede <strong className="text-foreground">yeterli korumanın bulunması</strong> veya veri sorumlusunun yeterli korumayı yazılı olarak taahhüt etmesi koşulu aranır.
            </p>
          </article>

          {/* MADDE 9 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 9 – KİŞİSEL VERİLERİN SAKLANMA SÜRESİ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Kişisel verileriniz, işlenme amaçlarının gerektirdiği süre boyunca ve her halükarda ilgili mevzuatta öngörülen <strong className="text-foreground">asgari saklama sürelerinden kısa olmamak üzere</strong> saklanır:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[14px] border border-border/30 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-foreground border-b border-border/30">Veri Türü</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground border-b border-border/30">Saklama Süresi</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20">
                    <td className="px-4 py-2.5">Hesap verileri</td>
                    <td className="px-4 py-2.5"><strong className="text-foreground">Üyelik sona erdikten sonra 5 yıl</strong></td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="px-4 py-2.5">İşlem logları ve denetim kayıtları</td>
                    <td className="px-4 py-2.5"><strong className="text-foreground">10 yıl</strong></td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="px-4 py-2.5">Yasal uyuşmazlıklara konu olabilecek veriler</td>
                    <td className="px-4 py-2.5"><strong className="text-foreground">Zamanaşımı süresi sona erene kadar</strong></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5">Finansal işlemlere ilişkin veriler</td>
                    <td className="px-4 py-2.5"><strong className="text-foreground">TTK ve VUK gereğince 10 yıl</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[14px] leading-relaxed text-muted-foreground mt-3">
              Saklama süresinin sona ermesi halinde veriler <strong className="text-foreground">KVKK&apos;nın 7. maddesi</strong> kapsamında silinir, yok edilir veya <strong className="text-foreground">anonim hale getirilir</strong>. Anonim hale getirme işlemi geri dönüşümsüz niteliktedir.
            </p>
          </article>

          {/* MADDE 10 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 10 – VERİ GÜVENLİĞİ ÖNLEMLERİ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, kişisel verilerin hukuka aykırı olarak işlenmesini önlemek amacıyla <strong className="text-foreground">sektör standartlarına uygun</strong> teknik ve idari güvenlik tedbirleri almaktadır:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li><strong className="text-foreground">TLS 1.3</strong> şifreleme ile aktarım güvenliği</li>
              <li><strong className="text-foreground">AES-256</strong> şifreleme ile veri depolama güvenliği</li>
              <li>Parola hashleme algoritmaları (<strong className="text-foreground">bcrypt, Argon2</strong>)</li>
              <li>Ağ güvenlik duvarları ve <strong className="text-foreground">DDoS koruma</strong> sistemleri</li>
              <li>Çok faktörlü kimlik doğrulama (<strong className="text-foreground">MFA/2FA</strong>)</li>
              <li>Düzenli <strong className="text-foreground">güvenlik denetimleri</strong> ve penetrasyon testleri</li>
              <li>Erişim kontrol listeleri (<strong className="text-foreground">ACL</strong>) ve rol tabanlı yetkilendirme</li>
              <li>Güvenlik olayı izleme ve uyarı sistemleri</li>
              <li>Veri yedekleme ve <strong className="text-foreground">felaket kurtarma planları</strong></li>
              <li>Çalışanlara yönelik veri güvenliği eğitimleri</li>
              <li><strong className="text-foreground">Veri minimizasyonu</strong> ilkesinin uygulanması</li>
              <li>Günlük otomatik güvenlik taramaları</li>
            </ul>
          </article>

          {/* MADDE 11 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 11 – KVKK KAPSAMINDAKİ İLGİLİ KİŞİ HAKLARI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              <strong className="text-foreground">KVKK&apos;nın 11. maddesi</strong> kapsamında, ilgili kişi olarak aşağıdaki haklara sahipsiniz:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Kişisel verilerinizin <strong className="text-foreground">işlenip işlenmediğini öğrenme</strong></li>
              <li>Kişisel verileriniz işlenmişse buna ilişkin <strong className="text-foreground">bilgi talep etme</strong></li>
              <li>Kişisel verilerinizin <strong className="text-foreground">işlenme amacını</strong> ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içinde veya yurt dışında kişisel verilerinizin <strong className="text-foreground">aktarıldığı üçüncü kişileri bilme</strong></li>
              <li>Kişisel verilerinizin eksik veya yanlış işlenmiş olması halinde <strong className="text-foreground">düzeltilmesini isteme</strong></li>
              <li>KVKK&apos;nın 7. maddesi çerçevesinde kişisel verilerinizin <strong className="text-foreground">silinmesini veya yok edilmesini isteme</strong></li>
              <li>Yapılan işlemlerin aktarıldığı <strong className="text-foreground">üçüncü kişilere bildirilmesini</strong> isteme</li>
              <li>İşlenen verilerin otomatik sistemler vasıtasıyla analiz edilmesi suretiyle <strong className="text-foreground">aleyhinize bir sonuç ortaya çıkmasına itiraz etme</strong></li>
              <li>Kişisel verilerin kanuna aykırı işlenmesi sebebiyle zarara uğramanız halinde <strong className="text-foreground">zararın giderilmesini talep etme</strong></li>
            </ol>
          </article>

          {/* MADDE 12 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 12 – GDPR KAPSAMINDAKİ EK HAKLAR
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              <strong className="text-foreground">Avrupa Ekonomik Alanı (AEA)</strong> dahilinde ikamet eden kullanıcılar, GDPR kapsamında aşağıdaki ek haklara sahiptir:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li><strong className="text-foreground">Veri taşınabilirliği hakkı</strong> (Madde 20) – kişisel verilerinizi yapılandırılmış, yaygın olarak kullanılan ve makine tarafından okunabilir bir formatta alma hakkı</li>
              <li><strong className="text-foreground">Unutulma hakkı</strong> (Madde 17) – belirli koşullar altında kişisel verilerinizin silinmesini talep etme hakkı</li>
              <li><strong className="text-foreground">İşlemeyi kısıtlama hakkı</strong> (Madde 18)</li>
              <li><strong className="text-foreground">İtiraz hakkı</strong> (Madde 21) – meşru menfaat dayanaklı veri işlemeye itiraz etme hakkı</li>
              <li><strong className="text-foreground">Otomatik karar alma ve profillemeye ilişkin haklar</strong> (Madde 22)</li>
              <li><strong className="text-foreground">Denetim makamına şikayet hakkı</strong> (Madde 77)</li>
            </ol>
          </article>

          {/* MADDE 13 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 13 – BAŞVURU PROSEDÜRÜ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Yukarıda belirtilen haklarınızı kullanmak için aşağıdaki yöntemlerden birini tercih edebilirsiniz:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground mb-3">
              <li>Platform üzerindeki <strong className="text-foreground">&quot;Hesap Ayarları &gt; Gizlilik&quot;</strong> bölümü aracılığıyla</li>
              <li><strong className="text-foreground">noreply@bondley.one</strong> elektronik posta adresine ileti göndererek</li>
              <li>Kayıtlı elektronik posta (<strong className="text-foreground">KEP</strong>) adresi üzerinden</li>
              <li>Noter aracılığıyla Şirket merkezine fiziki başvuru yaparak</li>
            </ol>
            <div className="bg-muted/30 rounded-xl p-4 text-[14px] text-muted-foreground">
              <strong className="text-foreground">⏱ Yanıt süresi:</strong> Veri sorumlusu, başvurunuzu en geç <strong className="text-foreground">30 (otuz) gün</strong> içinde sonuçlandıracaktır. İşlemin ayrıca bir maliyet gerektirmesi halinde, KVKK Kurulu tarafından belirlenen tarife esas alınır.
            </div>
          </article>

          {/* MADDE 14 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 14 – OTOMATİK KARAR ALMA VE PROFİLLEME
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, kullanıcı hizmet düzeyinin belirlenmesi, güvenlik risk analizlerinin yapılması ve kullanıcı deneyiminin kişiselleştirilmesi amacıyla <strong className="text-foreground">otomatik karar alma mekanizmaları</strong> ve profilleme teknikleri kullanabilmektedir.
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, <strong className="text-foreground">yalnızca güvenlik doğrulaması ve hile önleme</strong> amacıyla otomatik karar alma kullanmakta olup, ticari avantaj veya dezavantaj oluşturacak nitelikte otomatik kararlar <strong className="text-foreground">almamaktadır</strong>.
            </p>
            <div className="bg-primary/5 rounded-xl p-4 text-[14px] text-muted-foreground border border-primary/10">
              <strong className="text-foreground">Haklarınız:</strong> İlgili kişi olarak, otomatik karar alma süreçlerine <strong className="text-foreground">itiraz etme</strong>, <strong className="text-foreground">insan müdahalesi talep etme</strong> ve kararın yeniden değerlendirilmesini isteme hakkına sahipsiniz.
            </div>
          </article>

          {/* MADDE 15 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 15 – ÜÇÜNCÜ TARAF HİZMETLER VE BAĞLANTILAR
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, üçüncü taraf web siteleri, hizmetler ve uygulamalarla bağlantılar içerebilir. Bu bağlantılar aracılığıyla eriştiğiniz üçüncü taraf siteler, <strong className="text-foreground">kendi gizlilik politikaları</strong> ve veri işleme uygulamalarına tabidir. Bondley, üçüncü taraf sitelerin gizlilik uygulamaları hakkında <strong className="text-foreground">herhangi bir sorumluluk üstlenmez</strong>.
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-2">
              <strong className="text-foreground">Platformda kullanılan başlıca üçüncü taraf hizmetleri:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[14px] text-muted-foreground">
              <li>Bulut altyapı sağlayıcıları (PostgreSQL veritabanı barındırma)</li>
              <li>CDN hizmetleri</li>
              <li>E-posta gönderim altyapısı</li>
              <li>Hata izleme hizmetleri (<strong className="text-foreground">Sentry</strong>)</li>
              <li>SSL/TLS sertifika sağlayıcıları</li>
            </ul>
          </article>

          {/* MADDE 16 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 16 – ÇOCUKLARIN KİŞİSEL VERİLERİ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Platform, <strong className="text-foreground">18 yaşın altındaki bireylere</strong> yönelik bir hizmet sunmamaktadır ve bilinçli olarak 18 yaşın altındaki bireylerden kişisel veri toplamamaktadır. 18 yaşın altında olduğunuzu tespit etmemiz halinde, hesabınız <strong className="text-foreground">derhal askıya alınacak</strong> ve toplanan tüm kişisel veriler KVKK&apos;nın 7. maddesi kapsamında <strong className="text-foreground">silinecek veya yok edilecektir</strong>. Bir çocuğun ebeveyn veya yasal vasi onayı olmaksızın kişisel verilerini Platform&apos;a sunduğunu tespit etmeniz durumunda, lütfen derhal bizimle iletişime geçiniz.
            </p>
          </article>

          {/* MADDE 17 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 17 – VERİ İHLALİ BİLDİRİM PROSEDÜRÜ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Kişisel verilerin hukuka aykırı olarak üçüncü kişiler tarafından ele geçirilmesi (<strong className="text-foreground">veri ihlali</strong>) halinde, Platform:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>En kısa sürede ve her halükarda ihlalden haberdar olmasından itibaren <strong className="text-foreground">72 saat içinde</strong> Kişisel Verileri Koruma Kurulu&apos;na bildirimde bulunacaktır</li>
              <li>İhlalin <strong className="text-foreground">yüksek risk</strong> oluşturması halinde, ilgili kişileri makul sürede bilgilendirecektir</li>
              <li>İhlalin kapsamı, etki alanı, alınan önlemler ve tavsiye edilen tedbirleri içeren <strong className="text-foreground">detaylı bir bildirim raporu</strong> hazırlayacaktır</li>
              <li>İhlali tekrarlamamak adına gerekli <strong className="text-foreground">teknik ve idari önlemleri derhal</strong> alacaktır</li>
            </ol>
          </article>

          {/* MADDE 18 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 18 – ULUSLARARASI VERİ AKTARIMI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform altyapısının bir kısmı, Türkiye dışında konumlandırılmış sunucularda barındırılabilir. Yurt dışına veri aktarımı halinde:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Aktarımın yapıldığı ülkenin <strong className="text-foreground">KVKK Kurulu tarafından yeterli koruma sağladığı ilan edilen ülkeler</strong> arasında olup olmadığı kontrol edilir</li>
              <li>Yeterli koruma bulunmayan ülkelere aktarım halinde, <strong className="text-foreground">Standart Sözleşme Hükümleri (SCC)</strong>, <strong className="text-foreground">Bağlayıcı Kurumsal Kurallar (BCR)</strong> veya ilgili kişinin açık rızası gibi uygun güvenceler sağlanır</li>
              <li>GDPR kapsamındaki aktarımlarda <strong className="text-foreground">Madde 44-49</strong> hükümleri esas alınır</li>
              <li>Aktarım yapılan tüm taraflarla <strong className="text-foreground">Veri İşleme Sözleşmeleri (DPA)</strong> imzalanır</li>
            </ol>
          </article>

          {/* MADDE 19 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 19 – ELEKTRONİK TİCARİ İLETİ VE PAZARLAMA
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              <strong className="text-foreground">6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun</strong> uyarınca, ticari elektronik ileti gönderilebilmesi için alıcının <strong className="text-foreground">önceden onayının alınması zorunludur</strong>.
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-2">
              Platform, aşağıdaki durumlarda elektronik ticari ileti gönderebilir:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[14px] text-muted-foreground mb-3">
              <li>Kayıt sırasında veya sonrasında <strong className="text-foreground">açık onay verilmişse</strong></li>
              <li>Mevcut müşteri ilişkisi kapsamında, benzer hizmetlere ilişkin bilgilendirme gönderilmesi halinde <em>(opt-out hakkı saklı)</em></li>
            </ul>
            <div className="bg-muted/30 rounded-xl p-4 text-[14px] text-muted-foreground">
              <strong className="text-foreground">Red hakkı:</strong> Red talebiniz, talebinizin ulaştığı tarihten itibaren <strong className="text-foreground">3 (üç) iş günü</strong> içinde yerine getirilir. <strong className="text-foreground">İleti Yönetim Sistemi (İYS)</strong> üzerinden de tercihlerinizi yönetebilirsiniz.
            </div>
          </article>

          {/* MADDE 20 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 20 – FİNANSAL VERİLERE İLİŞKİN ÖZEL HÜKÜMLER
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, borçlanma araçları değerleme ve analiz hizmeti sunmakta olup, kullanıcıların finansal kararlarına yönelik <strong className="text-foreground">herhangi bir yatırım tavsiyesi vermemektedir</strong>. Platforma girilen veya Platform tarafından hesaplanan finansal veriler (tahvil fiyatları, getiri oranları, spread değerleri, duration hesaplamaları vb.) <strong className="text-foreground">yalnızca bilgilendirme amaçlıdır</strong>.
            </p>
            <div className="bg-destructive/5 rounded-xl p-4 text-[14px] text-muted-foreground border border-destructive/15">
              <strong className="text-foreground">⚠️ Sorumluluk Reddi:</strong> Bu verilere dayalı olarak alınan yatırım kararlarından <strong className="text-foreground">Bondley sorumlu tutulamaz</strong>. Finansal verilerin işlenmesinde TÜBİTAK ULAKBİM güvenlik standartlarına ve SPK düzenlemelerine uyulur.
            </div>
          </article>

          {/* MADDE 21 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 21 – LOG KAYITLARI VE DENETİM İZLERİ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, güvenlik, hata tespiti, performans analizi ve yasal yükümlülüklerin karşılanması amacıyla <strong className="text-foreground">kapsamlı log kayıtları</strong> tutmaktadır:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[14px] text-muted-foreground mb-3">
              <li><strong className="text-foreground">Erişim logları:</strong> Tarih, saat, IP adresi, erişilen kaynak, HTTP metodu, yanıt kodu</li>
              <li><strong className="text-foreground">Kimlik doğrulama logları:</strong> Başarılı/başarısız giriş denemeleri, MFA doğrulamaları, oturum olayları</li>
              <li><strong className="text-foreground">İşlem logları:</strong> Kullanıcı eylemleri, veri erişim kayıtları, hesaplama talepleri</li>
              <li><strong className="text-foreground">Hata logları:</strong> Uygulama hataları, sistem istisnaları, performans anormallikleri</li>
              <li><strong className="text-foreground">Güvenlik logları:</strong> Şüpheli aktiviteler, rate limiting tetiklenmeleri, yetkisiz erişim denemeleri</li>
            </ul>
            <div className="bg-muted/30 rounded-xl p-4 text-[14px] text-muted-foreground">
              <strong className="text-foreground">Yasal zorunluluk:</strong> Log kayıtları, <strong className="text-foreground">5651 sayılı Kanun</strong> gereğince en az <strong className="text-foreground">2 (iki) yıl</strong> süreyle saklanır.
            </div>
          </article>

          {/* MADDE 22 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 22 – ANONİMLEŞTİRME VE TAKMA AD KULLANIMI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, <strong className="text-foreground">veri minimizasyonu</strong> ilkesi doğrultusunda, kişisel verilerin mümkün olan en erken aşamada anonimleştirilmesi veya takma adla (<em>pseudonymization</em>) değiştirilmesi yöntemlerini uygulamaktadır.
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li><strong className="text-foreground">Anonimleştirme:</strong> Kişisel verilerin başka verilerle eşleştirerek dahi kimliği belirlenebilir bir kişiyle ilişkilendirilememesi durumu. Anonimleştirilmiş veriler <strong className="text-foreground">KVKK kapsamında kişisel veri sayılmaz</strong>.</li>
              <li><strong className="text-foreground">Takma ad kullanımı (Pseudonymization):</strong> Ek bilgi kullanılmaksızın verilerin belirli bir kişiyle ilişkilendirilememesi durumu. Bu yöntemle işlenen veriler <strong className="text-foreground">hâlâ kişisel veri statüsündedir</strong>.</li>
            </ul>
          </article>

          {/* MADDE 23 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 23 – API ERİŞİMİ VE VERİ ENTEGRASYONLARI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, B2B müşterilerine <strong className="text-foreground">API aracılığıyla entegrasyon</strong> imkanı sunmaktadır. API erişimi kapsamında:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Her API çağrısı, <strong className="text-foreground">JWT (JSON Web Token)</strong> ile yetkilendirilir</li>
              <li>API çağrı logları, <strong className="text-foreground">güvenlik ve faturalama</strong> amacıyla saklanır</li>
              <li><strong className="text-foreground">Rate limiting</strong> uygulanarak hizmet reddi saldırılarına karşı koruma sağlanır</li>
              <li>API aracılığıyla iletilen tüm veriler <strong className="text-foreground">TLS 1.3</strong> şifreleme ile korunur</li>
              <li>API kullanıcıları, <strong className="text-foreground">Veri İşleme Sözleşmesi (DPA)</strong> imzalamakla yükümlüdür</li>
              <li>API anahtarları <strong className="text-foreground">kriptografik olarak hashlenmiş</strong> biçimde saklanır</li>
              <li>API kullanım kotaları ve erişim düzeyleri, <strong className="text-foreground">abonelik planına göre</strong> belirlenir</li>
            </ol>
          </article>

          {/* MADDE 24 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 24 – FELAKET KURTARMA VE İŞ SÜREKLİLİĞİ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, kişisel verilerin korunmasını sağlamak üzere kapsamlı bir <strong className="text-foreground">felaket kurtarma ve iş sürekliliği planı</strong> uygulamaktadır:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Veritabanının düzenli olarak yedeklenmesi (<strong className="text-foreground">günlük tam yedekleme, saatlik artımlı yedekleme</strong>)</li>
              <li>Yedeklerin <strong className="text-foreground">coğrafi olarak farklı lokasyonlarda</strong> şifreli olarak saklanması</li>
              <li>Felaket senaryolarında hizmetin en fazla <strong className="text-foreground">4 saat içinde</strong> yeniden devreye alınması hedefi (RTO)</li>
              <li>En fazla <strong className="text-foreground">1 saatlik</strong> veri kaybı toleransı (RPO)</li>
              <li>Yılda en az <strong className="text-foreground">iki kez</strong> felaket kurtarma tatbikatı yapılması</li>
              <li>Yedek verilere yetkisiz erişimin önlenmesi için ayrı erişim kontrol mekanizmaları</li>
            </ul>
          </article>

          {/* MADDE 25 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 25 – OTURUM YÖNETİMİ VE GÜVENLİK
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, kullanıcı oturumlarının güvenliğini sağlamak amacıyla aşağıdaki önlemleri almaktadır:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Oturum tokenları <strong className="text-foreground">JWT standardında</strong>, RS256 veya HS256 algoritmaları ile imzalanır</li>
              <li>Access token süresi <strong className="text-foreground">15-30 dakika</strong>, refresh token süresi <strong className="text-foreground">7-30 gün</strong> ile sınırlıdır</li>
              <li>Her yeni oturum için <strong className="text-foreground">benzersiz oturum tanımlayıcı</strong> oluşturulur</li>
              <li>Eşzamanlı oturum sayısı sınırlandırılabilir</li>
              <li>Şüpheli aktivite tespit edilmesi halinde tüm oturumlar <strong className="text-foreground">otomatik olarak sonlandırılır</strong></li>
              <li>Oturum bilgileri <strong className="text-foreground">httpOnly</strong> ve <strong className="text-foreground">secure</strong> bayrağı ile korunur</li>
              <li><strong className="text-foreground">CSRF koruması</strong> uygulanır</li>
              <li>Belirli bir süre hareketsizlik sonrasında oturum otomatik olarak sonlandırılır</li>
            </ul>
          </article>

          {/* MADDE 26 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 26 – PAROLA POLİTİKASI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, kullanıcı hesaplarının güvenliğini sağlamak amacıyla aşağıdaki <strong className="text-foreground">parola politikasını</strong> uygulamaktadır:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Minimum parola uzunluğu <strong className="text-foreground">8 karakter</strong>dir</li>
              <li>Parolalar <strong className="text-foreground">bcrypt veya Argon2id</strong> algoritması ile hashlenmiş olarak saklanır, düz metin olarak <strong className="text-foreground">saklanmaz</strong></li>
              <li>İki faktörlü kimlik doğrulama (<strong className="text-foreground">2FA/MFA</strong>) opsiyonel olarak sunulur ve <strong className="text-foreground">TOTP standardını</strong> destekler</li>
              <li>Belirli sayıda başarısız giriş denemesi sonrasında hesap <strong className="text-foreground">geçici olarak kilitlenir</strong> (rate limiting)</li>
              <li>Parola değişikliği işlemlerinde <strong className="text-foreground">mevcut parolanın doğrulanması</strong> zorunludur</li>
              <li>Parola sıfırlama tokenları <strong className="text-foreground">zaman sınırlıdır</strong> ve tek kullanımlıktır</li>
            </ul>
          </article>

          {/* MADDE 27 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 27 – E-POSTA GÜVENLİĞİ
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform tarafından gönderilen tüm e-postalarda güvenlik standartlarına uyulur:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>E-posta sunucuları <strong className="text-foreground">TLS şifreleme</strong> ile korunur</li>
              <li><strong className="text-foreground">SPF, DKIM ve DMARC</strong> kayıtları yapılandırılarak e-posta sahteciliği önlenir</li>
              <li>E-posta doğrulama tokenları <strong className="text-foreground">tek kullanımlıktır</strong> ve belirlenen süre sonunda geçersiz hale gelir</li>
              <li>Hassas bilgiler e-posta ile düz metin olarak <strong className="text-foreground">iletilmez</strong>; güvenli platforma yönlendirme yapılır</li>
              <li>E-posta iletim logları, hizmet sağlayıcı tarafından <strong className="text-foreground">90 gün</strong> süreyle saklanır</li>
              <li><strong className="text-foreground">Oltalama (phishing)</strong> saldırılarına karşı kullanıcılar uyarılır</li>
            </ul>
          </article>

          {/* MADDE 28 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 28 – ERİŞİM KONTROLÜ VE YETKİLENDİRME
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, <strong className="text-foreground">Rol Tabanlı Erişim Kontrolü (RBAC)</strong> uygulayarak kişisel verilere erişimi sınırlandırmaktadır:
            </p>
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-[14px] border border-border/30 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-foreground border-b border-border/30">Rol</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground border-b border-border/30">Erişim Düzeyi</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20">
                    <td className="px-4 py-2.5"><strong className="text-foreground">Admin</strong></td>
                    <td className="px-4 py-2.5">Tam sistem erişimi, kullanıcı yönetimi, sistem konfigürasyonu</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="px-4 py-2.5"><strong className="text-foreground">Premium User</strong></td>
                    <td className="px-4 py-2.5">Gelişmiş özellikler, detaylı raporlama, API erişimi</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="px-4 py-2.5"><strong className="text-foreground">Pro User</strong></td>
                    <td className="px-4 py-2.5">Standart özellikler, sınırlı API erişimi</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5"><strong className="text-foreground">Free User</strong></td>
                    <td className="px-4 py-2.5">Temel özellikler, kısıtlı veri erişimi</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Her rol, <strong className="text-foreground">minimum yetki ilkesi</strong> (<em>principle of least privilege</em>) doğrultusunda yalnızca görevinin gerektirdiği verilere erişim hakkına sahiptir. Tüm yetkili erişimler <strong className="text-foreground">denetim loglarına kaydedilir</strong>.
            </p>
          </article>

          {/* MADDE 29 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 29 – KVKK UYUMLULUK PROGRAMI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform, <strong className="text-foreground">KVKK ve ilgili mevzuat ile tam uyumu</strong> sürdürmeye yönelik kapsamlı bir uyumluluk programı yürütmektedir:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Kişisel veri <strong className="text-foreground">envanter ve işleme süreçlerinin</strong> belgelenmesi</li>
              <li><strong className="text-foreground">Veri İşleme Etki Değerlendirmesi (DPIA)</strong> çalışmalarının yapılması</li>
              <li><strong className="text-foreground">Aydınlatma metinlerinin</strong> güncel tutulması</li>
              <li>Açık rıza beyanlarının mevzuata uygun biçimde alınması ve saklanması</li>
              <li><strong className="text-foreground">Veri işleme sözleşmelerinin</strong> üçüncü taraflarla imzalanması</li>
              <li>Periyodik <strong className="text-foreground">iç denetim</strong> ve uyumluluk değerlendirmeleri</li>
              <li>Kişisel veri <strong className="text-foreground">ihlal müdahale planının</strong> güncel tutulması</li>
              <li>Çalışan <strong className="text-foreground">farkındalık eğitimlerinin</strong> düzenlenmesi</li>
            </ol>
          </article>

          {/* MADDE 30 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 30 – VERİ ETKİ DEĞERLENDİRMESİ (DPIA)
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Kişisel verilerin işlenmesinin bireylerin hak ve özgürlükleri üzerinde <strong className="text-foreground">yüksek risk oluşturma ihtimalinin</strong> bulunduğu durumlarda, Platform <strong className="text-foreground">veri koruma etki değerlendirmesi (DPIA)</strong> gerçekleştirmektedir. DPIA, yeni bir veri işleme faaliyeti başlatılmadan önce veya mevcut işleme faaliyetlerinde önemli değişiklikler yapılmadan önce uygulanır. Değerlendirme; işleme faaliyetinin sistematik tanımı, amaçların orantılılık değerlendirmesi, <strong className="text-foreground">risk analizi</strong>, risk azaltma tedbirleri ve istisnai durum planlarını kapsar. DPIA sonuçları belgelenir ve gerektiğinde <strong className="text-foreground">Kişisel Verileri Koruma Kurulu</strong> ile paylaşılır.
            </p>
          </article>

          {/* MADDE 31 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 31 – E-POSTA DOĞRULAMA VE HESAP AKTİVASYONU
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Platform güvenliğini artırmak ve spam hesapların önüne geçmek amacıyla, kayıt işleminin tamamlanması için <strong className="text-foreground">e-posta doğrulama zorunlu</strong> tutulmaktadır. Kayıt sırasında girilen e-posta adresine bir doğrulama bağlantısı gönderilir. Bu bağlantı belirli bir süre (genellikle <strong className="text-foreground">24-48 saat</strong>) geçerlidir. Doğrulama tamamlanmadan hesap, tam işlevsellikle kullanılamaz. E-posta adresi değişikliği yapıldığında <strong className="text-foreground">yeni adresin doğrulanması da zorunludur</strong>.
            </p>
          </article>

          {/* MADDE 32 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 32 – GİZLİLİK POLİTİKASI ONAY MEKANİZMASI
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Platform&apos;a kayıt olurken tüm kullanıcılardan, işbu Gizlilik ve Çerez Politikası&apos;nı <strong className="text-foreground">okuduklarına ve kabul ettiklerine dair açık onay</strong> alınmaktadır:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Kayıt formunda <strong className="text-foreground">&quot;Gizlilik Politikasını okudum ve kabul ediyorum&quot;</strong> kutucuğunun işaretlenmesi suretiyle alınır</li>
              <li><strong className="text-foreground">Onay olmaksızın</strong> kayıt işlemi tamamlanamaz</li>
              <li>Onay tarihi, saati ve onay veren kullanıcının IP adresi dahil olmak üzere <strong className="text-foreground">kayıt altına alınır</strong></li>
              <li>Bu onay kaydı, Platform veritabanında güvenli biçimde saklanır ve <strong className="text-foreground">yasal delil niteliğindedir</strong></li>
              <li>Kullanıcı, onayını dilediği zaman <strong className="text-foreground">geri çekme hakkına</strong> sahiptir; ancak onayın geri çekilmesi, hizmetlerin kısmen veya tamamen durdurulmasına yol açabilir</li>
              <li>Gizlilik politikasında önemli değişiklikler yapılması halinde, kullanıcılardan <strong className="text-foreground">yeniden onay alınması</strong> değerlendirilecektir</li>
            </ol>
          </article>

          {/* MADDE 33 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 33 – UYUŞMAZLIK ÇÖZÜMÜ VE YETKİLİ MAHKEME
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              İşbu Politika&apos;dan kaynaklanan veya Politika ile bağlantılı tüm uyuşmazlıkların çözümünde öncelikle <strong className="text-foreground">dostane yollar</strong> (müzakere, arabuluculuk) denenecektir. Uyuşmazlığın dostane yollarla çözümlenememesi halinde, <strong className="text-foreground">Türkiye Cumhuriyeti kanunları</strong> uygulanacak ve <strong className="text-foreground">İstanbul Mahkemeleri ve İcra Daireleri</strong> münhasıran yetkili olacaktır. GDPR kapsamındaki uyuşmazlıklarda, ilgili kişinin ikamet ettiği AEA üye devletindeki denetim makamına başvuru hakkı saklıdır.
            </p>
          </article>

          {/* MADDE 34 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 34 – POLİTİKA DEĞİŞİKLİKLERİ VE BİLDİRİM
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              İşbu Politika, herhangi bir zamanda Bondley tarafından <strong className="text-foreground">tek taraflı olarak değiştirilebilir</strong>, güncellenebilir veya yeniden düzenlenebilir. Politika değişiklikleri:
            </p>
            <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-[14px] text-muted-foreground">
              <li>Platform üzerinde <strong className="text-foreground">güncellenmiş metnin yayımlanması</strong> ile yürürlüğe girer</li>
              <li>Önemli değişikliklerde kayıtlı e-posta adresine <strong className="text-foreground">bildirim gönderilebilir</strong></li>
              <li>Değişiklik tarihi, Politika&apos;nın başında <strong className="text-foreground">&quot;Son Güncelleme&quot;</strong> tarihi olarak gösterilir</li>
              <li>Değişiklik sonrasında Platform&apos;un <strong className="text-foreground">kullanılmaya devam edilmesi</strong>, güncellenmiş Politika&apos;nın kabul edildiği anlamına gelir</li>
              <li>Bondley, Politika değişikliklerinin zamanlaması, kapsamı ve sıklığı konusunda <strong className="text-foreground">tam takdir yetkisine</strong> sahiptir</li>
            </ol>
          </article>

          {/* MADDE 35 */}
          <article>
            <h2 className="text-[20px] font-bold text-foreground tracking-tight pb-3 border-b border-border/30 mb-4">
              MADDE 35 – YÜRÜRLÜK VE BÜTÜNLÜK
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              İşbu Gizlilik ve Çerez Politikası, Platform üzerinde <strong className="text-foreground">yayımlandığı tarihte yürürlüğe girer</strong> ve aksine bir bildirim yapılmadıkça süresiz olarak yürürlükte kalır. Politika&apos;nın herhangi bir maddesinin yetkili bir mahkeme veya düzenleyici otorite tarafından geçersiz veya uygulanamaz bulunması halinde, söz konusu madde Politika&apos;dan bağımsız olarak değerlendirilir ve <strong className="text-foreground">diğer maddelerin geçerliliğini etkilemez</strong>. Bu Politika, kişisel verilerin korunmasına ilişkin olarak Platform ile kullanıcı arasındaki ilişkiyi düzenleyen <strong className="text-foreground">temel belge</strong> niteliğindedir ve <strong className="text-foreground">Platform Kullanım Koşulları</strong> ile birlikte değerlendirilir.
            </p>
          </article>

          {/* FINAL RESERVATION BLOCK */}
          <div className="mt-8 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-6">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <div>
                <p className="text-[15px] font-bold text-amber-700 dark:text-amber-300">
                  ⚠️ DEĞİŞİKLİK HAKKI TEKRAREN BEYAN
                </p>
                <p className="text-[13px] text-amber-700/90 dark:text-amber-300/80 mt-2 leading-relaxed">
                  Hizmet Verici Kurum olan <strong>Bondley</strong>, işbu Gizlilik ve Çerez Politikası&apos;nın tamamı veya herhangi bir maddesi üzerinde, <strong>önceden herhangi bir bildirimde bulunma yükümlülüğü olmaksızın</strong>, tek taraflı olarak değişiklik yapma, güncelleme, kaldırma, ek hükümler ekleme veya mevcut hükümleri tamamen yeniden düzenleme hakkını <strong>münhasıran saklı tutmaktadır</strong>. Bu hak, Platform&apos;un faaliyette olduğu tüm süre boyunca geçerlidir ve kullanıcıların söz konusu değişiklikleri düzenli olarak takip etmesi <strong>kendi sorumluluklarındadır</strong>. Güncellenen politikanın yürürlük tarihi, Platform üzerinde ilan edildiği tarihtir. Platform&apos;un kullanılmaya devam edilmesi, <strong>değişikliklerin bütünüyle kabul edildiği</strong> anlamını taşır.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-12 pt-8 border-t border-border/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[13px] text-muted-foreground">
              <p>
                Bu politika <strong className="text-foreground">35 madde</strong> halinde düzenlenmiş olup, tüm maddeleri tek bir bütünlük içinde yorumlanmalıdır.
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
