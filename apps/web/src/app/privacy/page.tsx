import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik ve Çerez Politikası – Bondley",
  description:
    "Bondley gizlilik politikası, kişisel verilerin korunması, çerez kullanımı ve KVKK uyumluluğu hakkında detaylı bilgi.",
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
            Bu gizlilik politikası, Bondley platformu tarafından kişisel verilerinizin nasıl toplandığını,
            işlendiğini, saklandığını ve korunduğunu ayrıntılı biçimde açıklamaktadır. Platformumuzu
            kullanarak aşağıda belirtilen koşulları kabul etmiş sayılırsınız.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="prose prose-neutral dark:prose-invert max-w-none
          prose-headings:font-semibold prose-headings:tracking-tight
          prose-h2:text-[20px] prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-3 prose-h2:border-b prose-h2:border-border/30
          prose-h3:text-[16px] prose-h3:mt-6 prose-h3:mb-3
          prose-p:text-[14px] prose-p:leading-relaxed prose-p:text-muted-foreground
          prose-li:text-[14px] prose-li:text-muted-foreground
          prose-strong:text-foreground prose-strong:font-semibold
        ">

          {/* RESERVATION OF RIGHTS NOTICE */}
          <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-6 mb-12">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <div>
                <p className="text-[14px] font-bold text-amber-700 dark:text-amber-300 !mt-0">
                  ÖNEMLİ UYARI – DEĞİŞİKLİK HAKKI SAKLI
                </p>
                <p className="text-[13px] text-amber-700/90 dark:text-amber-300/80 !mb-0 mt-2">
                  Bondley (&quot;Hizmet Verici Kurum&quot;), işbu Gizlilik ve Çerez Politikası&apos;nı herhangi bir zamanda, herhangi bir gerekçe göstermeksizin, önceden bildirimde bulunmaksızın veya bulunarak, tamamen kendi takdir yetkisi dahilinde, kısmen veya bütünüyle değiştirme, güncelleme, kaldırma veya yeniden düzenleme hakkını münhasıran ve kayıtsız şartsız olarak saklı tutar. Değişikliklerin yürürlük tarihi, platformda ilan edildiği andır. Kullanıcıların güncel politikayı düzenli olarak kontrol etmeleri kendi sorumluluklarındadır. Platformun kullanılmaya devam edilmesi, güncellenen politikanın bütünüyle kabul edildiği anlamına gelir.
                </p>
              </div>
            </div>
          </div>

          {/* MADDE 1 */}
          <h2>MADDE 1 – TANIMLAR VE KAPSAM</h2>
          <p>
            İşbu Gizlilik ve Çerez Politikası (&quot;Politika&quot;), Bondley ticari unvanı altında faaliyet gösteren borçlanma araçları değerleme ve analiz platformu (&quot;Platform&quot;, &quot;Hizmet&quot;, &quot;Bondley&quot;, &quot;Biz&quot;, &quot;Bizim&quot;) ile Platform&apos;u kullanan tüm gerçek ve tüzel kişiler (&quot;Kullanıcı&quot;, &quot;Siz&quot;, &quot;Sizin&quot;, &quot;Üye&quot;, &quot;Ziyaretçi&quot;) arasındaki kişisel verilerin işlenmesine ilişkin hüküm ve koşulları düzenler. Bu Politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;), Avrupa Birliği Genel Veri Koruma Tüzüğü (&quot;GDPR&quot;), Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve ilgili ikincil mevzuat ile uyumlu olarak hazırlanmıştır.
          </p>
          <p>
            Kişisel veri, kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgiyi ifade eder. Bu tanım kapsamında; ad, soyad, elektronik posta adresi, IP adresi, çerez tanımlayıcıları, cihaz parmak izi (device fingerprint), coğrafi konum verileri, kullanım geçmişi, tercih verileri, erişim logları, tarayıcı bilgileri, işletim sistemi türü ve sürümü, ekran çözünürlüğü ile benzeri tüm veriler kişisel veri olarak kabul edilir ve işbu Politika kapsamında korunur.
          </p>

          {/* MADDE 2 */}
          <h2>MADDE 2 – VERİ SORUMLUSU BİLGİLERİ</h2>
          <p>
            KVKK&apos;nın 10. maddesi gereğince veri sorumlusunun aydınlatma yükümlülüğü kapsamında: Bondley platformunun veri sorumlusu sıfatıyla hareket eden tüzel kişiliğidir. Veri sorumlusuna ilişkin iletişim bilgileri, Platform&apos;un &quot;İletişim&quot; sayfasında yer almakta olup, kişisel verilerinize ilişkin tüm başvurularınızı buradan iletebilirsiniz. Veri sorumlusu, Kişisel Verilerin Korunması Kurulu (&quot;Kurul&quot;) nezdinde Veri Sorumluları Sicili&apos;ne (&quot;VERBİS&quot;) kayıt yükümlülüğüne tabidir ve gerekli kayıt işlemlerini yasal süreler dahilinde gerçekleştirmiştir veya gerçekleştirecektir.
          </p>

          {/* MADDE 3 */}
          <h2>MADDE 3 – TOPLANAN KİŞİSEL VERİLER</h2>
          <p>
            Platform tarafından toplanan kişisel veriler aşağıda sınıflandırılmıştır. Her bir veri kategorisi, işlenme amacı ve hukuki dayanağı ile birlikte değerlendirilmelidir:
          </p>
          <h3>3.1 – Kimlik Verileri</h3>
          <p>
            Ad, soyad, kullanıcı adı, hesap numarası, e-posta adresi, şifre hash&apos;i (kriptografik olarak şifrelenmiş parola). Bu veriler, hesap oluşturma, kimlik doğrulama ve hesap güvenliğinin sağlanması amacıyla toplanır. Hukuki dayanak: sözleşmenin ifası, meşru menfaat.
          </p>
          <h3>3.2 – İletişim Verileri</h3>
          <p>
            Elektronik posta adresi, kurumsal telefon numarası (opsiyonel), şirket adresi bilgisi, konum bilgisi (il/ilçe düzeyinde). Bu veriler, kullanıcı ile iletişim kurulması, destek taleplerinin yanıtlanması ve yasal bildirimlerin iletilmesi amacıyla kullanılır. Hukuki dayanak: sözleşmenin ifası, yasal yükümlülük.
          </p>
          <h3>3.3 – Kurumsal ve Mesleki Veriler</h3>
          <p>
            Şirket/kurum adı, departman, unvan, faaliyet alanı, tahmini günlük kullanım hacmi, kullanım amacı. Bu veriler, B2B hizmet düzeyinin belirlenmesi, kullanıcı segmentasyonu ve ürün geliştirme süreçlerinde kullanılır. Hukuki dayanak: meşru menfaat, sözleşmenin ifası.
          </p>
          <h3>3.4 – Teknik ve Erişim Verileri</h3>
          <p>
            IP adresi (IPv4 ve IPv6), tarayıcı türü ve sürümü, işletim sistemi, cihaz türü (masaüstü, mobil, tablet), ekran çözünürlüğü, dil tercihi, saat dilimi, erişim zamanları, oturum süresi, sayfa görüntüleme verileri, tıklama verileri, kaydırma derinliği, fare hareketleri (anonim heat-map amacıyla), referans URL&apos;si, çıkış URL&apos;si. Bu veriler otomatik yollarla toplanır ve sistem güvenliği, performans optimizasyonu, hata tespiti ve kullanıcı deneyiminin iyileştirilmesi amacıyla işlenir. Hukuki dayanak: meşru menfaat.
          </p>
          <h3>3.5 – İşlem ve Kullanım Verileri</h3>
          <p>
            Görüntülenen tahvil/bono ISIN kodları, yapılan hesaplama detayları, filtreleme ve sıralama tercihleri, favorilere eklenen enstrümanlar, indirilen raporlar, API çağrı logları, kullanım sıklığı ve desen verileri. Bu veriler hizmetin sunulması, kişiselleştirme ve istatistiksel analiz amacıyla işlenir. Hukuki dayanak: sözleşmenin ifası, meşru menfaat.
          </p>
          <h3>3.6 – Güvenlik Verileri</h3>
          <p>
            İki faktörlü kimlik doğrulama (2FA/MFA) kayıtları, oturum açma/kapama logları, başarısız giriş denemeleri, şüpheli aktivite kayıtları, cihaz parmak izi hashleri. Bu veriler hesap güvenliğinin sağlanması ve yetkisiz erişimin önlenmesi amacıyla işlenir. Hukuki dayanak: meşru menfaat, yasal yükümlülük.
          </p>

          {/* MADDE 4 */}
          <h2>MADDE 4 – KİŞİSEL VERİLERİN TOPLANMA YÖNTEMLERİ</h2>
          <p>
            Kişisel verileriniz aşağıdaki yöntemler ile otomatik ve otomatik olmayan yollarla toplanmaktadır: (i) Platform üzerindeki kayıt ve üyelik formları aracılığıyla doğrudan sizden; (ii) Platform kullanımınız sırasında çerezler, piksel etiketleri, web işaretçileri ve benzeri izleme teknolojileri vasıtasıyla otomatik olarak; (iii) Üçüncü taraf analiz hizmetleri (Google Analytics, Sentry hata izleme vb.) aracılığıyla; (iv) E-posta iletişimleri yoluyla; (v) Müşteri destek talepleri ve geri bildirim formları aracılığıyla; (vi) API entegrasyonları üzerinden; (vii) Sunucu erişim logları aracılığıyla otomatik olarak. Tüm toplama yöntemleri için KVKK&apos;nın 5. ve 6. maddelerinde belirlenen hukuki dayanaklar esas alınır.
          </p>

          {/* MADDE 5 */}
          <h2>MADDE 5 – KİŞİSEL VERİLERİN İŞLENME AMAÇLARI</h2>
          <p>
            Toplanan kişisel veriler, aşağıda sıralanan amaçlarla sınırlı olmak üzere işlenmektedir: (a) Platform üyelik süreçlerinin yürütülmesi ve hesap yönetimi; (b) Borçlanma araçları değerleme, fiyat hesaplama ve analiz hizmetlerinin sunulması; (c) Kullanıcı kimlik doğrulama ve yetkilendirme süreçlerinin yönetimi; (d) Platform güvenliğinin sağlanması ve yetkisiz erişimin engellenmesi; (e) Yasal yükümlülüklerin yerine getirilmesi; (f) Müşteri destek hizmetlerinin sunulması; (g) Hizmet kalitesinin ölçülmesi ve iyileştirilmesi; (h) İstatistiksel analizlerin yapılması; (i) Kullanıcı deneyiminin kişiselleştirilmesi; (j) Pazarlama iletişimlerinin gönderilmesi (ayrıca onay alınması kaydıyla); (k) Yasal uyuşmazlıklarda delil teşkil etmesi; (l) Düzenleyici kurumlara raporlama yükümlülüklerinin yerine getirilmesi; (m) Kurumsal risk yönetimi ve iç denetim süreçleri; (n) B2B sözleşme yükümlülüklerinin ifası; (o) Platform altyapısının bakım ve geliştirme süreçleri.
          </p>

          {/* MADDE 6 */}
          <h2>MADDE 6 – KİŞİSEL VERİLERİN İŞLENMESİNİN HUKUKİ DAYANAĞI</h2>
          <p>
            Kişisel verileriniz, KVKK&apos;nın 5. maddesinin 2. fıkrasında belirlenen aşağıdaki hukuki dayanaklara istinaden işlenmektedir: (a) Kanunlarda açıkça öngörülmesi; (b) Fiili imkansızlık nedeniyle rızasını açıklayamayacak durumda bulunan veya rızasına hukuki geçerlilik tanınmayan kişinin kendisinin ya da bir başkasının hayatı veya beden bütünlüğünün korunması için zorunlu olması; (c) Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması kaydıyla, sözleşmenin taraflarına ait kişisel verilerin işlenmesinin gerekli olması; (d) Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması; (e) İlgili kişinin kendisi tarafından alenileştirilmiş olması; (f) Bir hakkın tesisi, kullanılması veya korunması için veri işlemenin zorunlu olması; (g) İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla, veri sorumlusunun meşru menfaatleri için veri işlenmesinin zorunlu olması. Ayrıca, GDPR kapsamında Madde 6(1)(a) ila 6(1)(f) hükümleri de ek hukuki dayanak olarak değerlendirilmektedir.
          </p>

          {/* MADDE 7 */}
          <h2>MADDE 7 – ÇEREZ (COOKIE) POLİTİKASI</h2>
          <p>
            Platform, kullanıcı deneyimini iyileştirmek, hizmetlerin düzgün çalışmasını sağlamak ve istatistiksel veriler toplamak amacıyla çeşitli çerez türleri kullanmaktadır. Çerez, web tarayıcınız aracılığıyla cihazınıza yerleştirilen küçük metin dosyalarıdır. Bu bölüm, kullanılan çerez türlerini, amaçlarını ve yönetim seçeneklerini kapsamlı biçimde açıklamaktadır.
          </p>
          <h3>7.1 – Zorunlu (Temel) Çerezler</h3>
          <p>
            Bu çerezler, Platform&apos;un temel işlevlerinin çalışması için mutlak surette gereklidir ve devre dışı bırakılamaz. Oturum yönetimi, güvenlik doğrulaması, yük dengeleme, kullanıcı tercih hafızası (dil, tema seçimi) gibi fonksiyonlar bu çerezler aracılığıyla sağlanır. Yasal dayanak: KVKK madde 5/2(c) – sözleşmenin ifası; ePrivacy Directive madde 5(3) – teknik olarak zorunlu çerezler. Saklama süresi: oturum bazlı veya en fazla 13 ay.
          </p>
          <h3>7.2 – Analiz ve Performans Çerezleri</h3>
          <p>
            Bu çerezler, Platform&apos;un kullanım istatistiklerini anonim olarak toplamak, sayfa yüklenme sürelerini ölçmek, popüler içerikleri belirlemek ve teknik hataları tespit etmek amacıyla kullanılır. Bu çerezler yalnızca kullanıcının açık rızası ile etkinleştirilir. Kullanılan araçlar: Google Analytics 4, Sentry performans izleme. Yasal dayanak: açık rıza (KVKK madde 5/1; GDPR madde 6/1(a)). Saklama süresi: en fazla 26 ay.
          </p>
          <h3>7.3 – Pazarlama ve Hedefleme Çerezleri</h3>
          <p>
            Bu çerezler, kullanıcılara kişiselleştirilmiş içerik ve reklamlar sunmak, reklam kampanyalarının etkinliğini ölçmek ve kullanıcı segmentasyonu yapmak amacıyla kullanılır. Bu çerezler yalnızca kullanıcının açık rızası ile etkinleştirilir. Üçüncü taraf çerezleri de bu kategoride yer alabilir. Yasal dayanak: açık rıza (KVKK madde 5/1; GDPR madde 6/1(a)). Saklama süresi: en fazla 13 ay.
          </p>
          <h3>7.4 – Çerez Yönetimi</h3>
          <p>
            Kullanıcılar, Platform&apos;a ilk erişimlerinde gösterilen çerez izin barı aracılığıyla tercihlerini belirleyebilir. Tercihler her zaman tarayıcı ayarlarından veya Platform&apos;un çerez ayarları bölümünden güncellenebilir. Zorunlu çerezler haricindeki tüm çerezler, kullanıcının açık rızası olmaksızın etkinleştirilmez. Çerezlerin tümünü reddetmeniz halinde Platform&apos;un belirli fonksiyonlarında kısıtlamalar yaşanabilir.
          </p>

          {/* MADDE 8 */}
          <h2>MADDE 8 – KİŞİSEL VERİLERİN AKTARIMI</h2>
          <p>
            Kişisel verileriniz, aşağıda belirtilen taraflarla, yalnızca belirtilen amaçlar ve hukuki dayanaklar doğrultusunda paylaşılabilir: (a) Yasal zorunluluk halinde yetkili kamu kurum ve kuruluşları (mahkemeler, savcılıklar, düzenleyici otorites, KVKK Kurulu); (b) Hizmet altyapısının sağlanması amacıyla bulut bilişim hizmet sağlayıcıları (sunucu barındırma, CDN hizmetleri); (c) E-posta gönderim hizmetleri sağlayıcıları; (d) Ödeme işleme hizmetleri sağlayıcıları; (e) Hata izleme ve performans analiz hizmetleri (Sentry); (f) İstatistiksel analiz hizmetleri; (g) Hukuk müşavirleri ve bağımsız denetim kuruluşları. Her bir veri aktarımında KVKK&apos;nın 8. ve 9. maddelerinde düzenlenen koşullara uyulur. Yurt dışına veri aktarımı halinde, aktarım yapılan ülkede yeterli korumanın bulunması veya veri sorumlusunun yeterli korumayı yazılı olarak taahhüt etmesi koşulu aranır.
          </p>

          {/* MADDE 9 */}
          <h2>MADDE 9 – KİŞİSEL VERİLERİN SAKLANMA SÜRESİ</h2>
          <p>
            Kişisel verileriniz, işlenme amaçlarının gerektirdiği süre boyunca ve her halükarda ilgili mevzuatta öngörülen asgari saklama sürelerinden kısa olmamak üzere saklanır. Hesap verileri, üyelik sona erdikten sonra 5 (beş) yıl; işlem logları ve denetim kayıtları 10 (on) yıl; yasal uyuşmazlıklara konu olabilecek veriler, zamanaşımı süresi sona erene kadar; finansal işlemlere ilişkin veriler, Türk Ticaret Kanunu ve Vergi Usul Kanunu gereğince 10 (on) yıl süreyle saklanır. Saklama süresinin sona ermesi halinde veriler KVKK&apos;nın 7. maddesi kapsamında silinir, yok edilir veya anonim hale getirilir. Anonim hale getirme işlemi geri dönüşümsüz niteliktedir ve bu işlem sonrasında veri, kişisel veri vasfını yitirir.
          </p>

          {/* MADDE 10 */}
          <h2>MADDE 10 – VERİ GÜVENLİĞİ ÖNLEMLERİ</h2>
          <p>
            Platform, kişisel verilerin hukuka aykırı olarak işlenmesini, erişilmesini, ifşa edilmesini, değiştirilmesini veya imha edilmesini önlemek amacıyla sektör standartlarına uygun teknik ve idari güvenlik tedbirleri almaktadır. Bu tedbirler şunları kapsar ancak bunlarla sınırlı değildir: (a) TLS 1.3 şifreleme ile aktarım güvenliği; (b) AES-256 şifreleme ile veri depolama güvenliği; (c) Parola hashleme algoritmaları (bcrypt, Argon2); (d) Ağ güvenlik duvarları ve DDoS koruma sistemleri; (e) Çok faktörlü kimlik doğrulama (MFA/2FA); (f) Düzenli güvenlik denetimleri ve penetrasyon testleri; (g) Erişim kontrol listeleri (ACL) ve rol tabanlı yetkilendirme; (h) Güvenlik olayı izleme ve uyarı sistemleri; (i) Veri yedekleme ve felaket kurtarma planları; (j) Çalışanlara yönelik veri güvenliği eğitimleri; (k) Veri minimizasyonu ilkesinin uygulanması; (l) Günlük otomatik güvenlik taramaları.
          </p>

          {/* MADDE 11 */}
          <h2>MADDE 11 – KVKK KAPSAMINDAKİ İLGİLİ KİŞİ HAKLARI</h2>
          <p>
            KVKK&apos;nın 11. maddesi kapsamında, ilgili kişi olarak aşağıdaki haklara sahipsiniz: (a) Kişisel verilerinizin işlenip işlenmediğini öğrenme; (b) Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme; (c) Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme; (d) Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme; (e) Kişisel verilerinizin eksik veya yanlış işlenmiş olması halinde bunların düzeltilmesini isteme; (f) KVKK&apos;nın 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme; (g) (e) ve (f) bentleri uyarınca yapılan işlemlerin, kişisel verilerinizin aktarıldığı üçüncü kişilere bildirilmesini isteme; (h) İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme; (ı) Kişisel verilerin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme.
          </p>

          {/* MADDE 12 */}
          <h2>MADDE 12 – GDPR KAPSAMINDAKİ EK HAKLAR</h2>
          <p>
            Avrupa Ekonomik Alanı (AEA) dahilinde ikamet eden kullanıcılar, GDPR kapsamında aşağıdaki ek haklara sahiptir: (a) Veri taşınabilirliği hakkı (Madde 20) – kişisel verilerinizi yapılandırılmış, yaygın olarak kullanılan ve makine tarafından okunabilir bir formatta alma hakkı; (b) Unutulma hakkı (Madde 17) – belirli koşullar altında kişisel verilerinizin silinmesini talep etme hakkı; (c) İşlemeyi kısıtlama hakkı (Madde 18); (d) İtiraz hakkı (Madde 21) – meşru menfaat dayanaklı veri işlemeye itiraz etme hakkı; (e) Otomatik karar alma ve profillemeye ilişkin haklar (Madde 22); (f) Denetim makamına şikayet hakkı (Madde 77).
          </p>

          {/* MADDE 13 */}
          <h2>MADDE 13 – BAŞVURU PROSEDÜRÜ</h2>
          <p>
            Yukarıda belirtilen haklarınızı kullanmak için aşağıdaki yöntemlerden birini tercih edebilirsiniz: (a) Platform üzerindeki &quot;Hesap Ayarları &gt; Gizlilik&quot; bölümü aracılığıyla; (b) kvkk@bondley.com elektronik posta adresine ileti göndererek; (c) Kayıtlı elektronik posta (KEP) adresi üzerinden; (d) Noter aracılığıyla Şirket merkezine fiziki başvuru yaparak. Başvurunuzda kimliğinizi tevsik edici bilgi ve belgeler ile talebinizin açık ve anlaşılır biçimde yer alması gerekmektedir. Veri sorumlusu, başvurunuzu en geç 30 (otuz) gün içinde sonuçlandıracaktır. İşlemin ayrıca bir maliyet gerektirmesi halinde, KVKK Kurulu tarafından belirlenen tarife esas alınır.
          </p>

          {/* MADDE 14 */}
          <h2>MADDE 14 – OTOMATİK KARAR ALMA VE PROFİLLEME</h2>
          <p>
            Platform, kullanıcı hizmet düzeyinin belirlenmesi, güvenlik risk analizlerinin yapılması ve kullanıcı deneyiminin kişiselleştirilmesi amacıyla otomatik karar alma mekanizmaları ve profilleme teknikleri kullanabilmektedir. Otomatik karar alma, kişisel verilerinizin tamamen otomatik yollarla değerlendirilmesi sonucunda, sizin hakkınızda hukuki sonuç doğuran veya sizi önemli ölçüde etkileyen kararların alınması anlamına gelir. Platform, yalnızca güvenlik doğrulaması ve hile önleme amacıyla otomatik karar alma kullanmakta olup, ticari avantaj veya dezavantaj oluşturacak nitelikte otomatik kararlar almamaktadır. İlgili kişi olarak, otomatik karar alma süreçlerine itiraz etme, insan müdahalesi talep etme ve kararın yeniden değerlendirilmesini isteme hakkına sahipsiniz.
          </p>

          {/* MADDE 15 */}
          <h2>MADDE 15 – ÜÇÜNCÜ TARAF HİZMETLER VE BAĞLANTILAR</h2>
          <p>
            Platform, üçüncü taraf web siteleri, hizmetler ve uygulamalarla bağlantılar içerebilir. Bu bağlantılar aracılığıyla eriştiğiniz üçüncü taraf siteler, kendi gizlilik politikaları ve veri işleme uygulamalarına tabidir. Bondley, üçüncü taraf sitelerin gizlilik uygulamaları, içerikleri veya hizmetleri hakkında herhangi bir sorumluluk üstlenmez. Üçüncü taraf hizmetlerine erişmeden önce ilgili hizmetin gizlilik politikasını okumanızı kesinlikle tavsiye ederiz. Platformda kullanılan başlıca üçüncü taraf hizmetleri: bulut altyapı sağlayıcıları (PostgreSQL veritabanı barındırma), CDN hizmetleri, e-posta gönderim altyapısı, hata izleme hizmetleri (Sentry), SSL/TLS sertifika sağlayıcıları.
          </p>

          {/* MADDE 16 */}
          <h2>MADDE 16 – ÇOCUKLARIN KİŞİSEL VERİLERİ</h2>
          <p>
            Platform, 18 yaşın altındaki bireylere yönelik bir hizmet sunmamaktadır ve bilinçli olarak 18 yaşın altındaki bireylerden kişisel veri toplamamaktadır. 18 yaşın altında olduğunuzu tespit etmemiz halinde, hesabınız derhal askıya alınacak ve toplanan tüm kişisel veriler KVKK&apos;nın 7. maddesi kapsamında silinecek veya yok edilecektir. Bir çocuğun ebeveyn veya yasal vasi onayı olmaksızın kişisel verilerini Platform&apos;a sunduğunu tespit etmeniz durumunda, lütfen derhal bizimle iletişime geçiniz.
          </p>

          {/* MADDE 17 */}
          <h2>MADDE 17 – VERİ İHLALİ BİLDİRİM PROSEDÜRÜ</h2>
          <p>
            Kişisel verilerin hukuka aykırı olarak üçüncü kişiler tarafından ele geçirilmesi (veri ihlali) halinde, Platform; (a) En kısa sürede ve her halükarda ihlalden haberdar olmasından itibaren 72 saat içinde Kişisel Verileri Koruma Kurulu&apos;na bildirimde bulunacaktır; (b) İhlalin ilgili kişilerin hak ve özgürlükleri üzerinde yüksek risk oluşturması halinde, ilgili kişileri makul sürede bilgilendirecektir; (c) İhlalin kapsamı, etki alanı, alınan önlemler ve tavsiye edilen tedbirleri içeren detaylı bir bildirim raporu hazırlayacaktır; (d) İhlali tekrarlamamak adına gerekli teknik ve idari önlemleri derhal alacaktır. Veri ihlali bildirimleri, kayıtlı e-posta adresinize veya Platform üzerinden anlık bildirim olarak iletilecektir.
          </p>

          {/* MADDE 18 */}
          <h2>MADDE 18 – ULUSLARARASI VERİ AKTARIMI</h2>
          <p>
            Platform altyapısının bir kısmı, Türkiye dışında konumlandırılmış sunucularda barındırılabilir. Bu durumda kişisel verileriniz, sunucunun bulunduğu ülkeye aktarılmış olacaktır. Yurt dışına veri aktarımı halinde: (a) Aktarımın yapıldığı ülkenin Kişisel Verileri Koruma Kurulu tarafından yeterli koruma sağladığı ilan edilen ülkeler arasında olup olmadığı kontrol edilir; (b) Yeterli koruma bulunmayan ülkelere aktarım halinde, standart sözleşme hükümleri (Standard Contractual Clauses – SCC), bağlayıcı kurumsal kurallar (Binding Corporate Rules – BCR) veya ilgili kişinin açık rızası gibi uygun güvenceler sağlanır; (c) GDPR kapsamındaki aktarımlarda Madde 44-49 hükümleri esas alınır; (d) Aktarım yapılan tüm taraflarla veri işleme sözleşmeleri (Data Processing Agreement – DPA) imzalanır.
          </p>

          {/* MADDE 19 */}
          <h2>MADDE 19 – ELEKTRONİK TİCARİ İLETİ VE PAZARLAMA</h2>
          <p>
            6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve ilgili yönetmelikler uyarınca, ticari elektronik ileti gönderilebilmesi için alıcının önceden onayının alınması zorunludur. Platform, aşağıdaki durumlarda elektronik ticari ileti gönderebilir: (a) Kayıt sırasında veya sonrasında açık onay verilmişse; (b) Mevcut müşteri ilişkisi kapsamında, daha önce satın alınan veya kullanılan hizmetlere benzer ürün/hizmetlere ilişkin bilgilendirme gönderilmesi halinde (opt-out hakkı saklı kalmak kaydıyla). Ticari elektronik iletilerde: red hakkının kullanılmasına ilişkin bilgi, gönderenin açık kimliği ve iletişim bilgileri yer alacaktır. Red talebiniz, talebinizin ulaştığı tarihten itibaren 3 (üç) iş günü içinde yerine getirilir. İleti Yönetim Sistemi (İYS) üzerinden de tercihlerinizi yönetebilirsiniz.
          </p>

          {/* MADDE 20 */}
          <h2>MADDE 20 – FİNANSAL VERİLERE İLİŞKİN ÖZEL HÜKÜMLER</h2>
          <p>
            Platform, borçlanma araçları değerleme ve analiz hizmeti sunmakta olup, kullanıcıların finansal kararlarına yönelik herhangi bir yatırım tavsiyesi vermemektedir. Platforma girilen veya Platform tarafından hesaplanan finansal veriler (tahvil fiyatları, getiri oranları, spread değerleri, duration hesaplamaları vb.) yalnızca bilgilendirme amaçlıdır. Bu verilere dayalı olarak alınan yatırım kararlarından Bondley sorumlu tutulamaz. Finansal hesaplama sonuçları, kullanıcı hesabına bağlı olarak saklanabilir ve kullanıcının talebi üzerine dışa aktarılabilir (veri taşınabilirliği hakkı kapsamında). Finansal verilerin işlenmesinde TÜBİTAK ULAKBİM güvenlik standartlarına ve SPK düzenlemelerine uyulur.
          </p>

          {/* MADDE 21 */}
          <h2>MADDE 21 – LOG KAYITLARI VE DENETİM İZLERİ</h2>
          <p>
            Platform, güvenlik, hata tespiti, performans analizi ve yasal yükümlülüklerin karşılanması amacıyla kapsamlı log kayıtları tutmaktadır. Bu kayıtlar şunları içerir: (a) Erişim logları: tarih, saat, IP adresi, erişilen kaynak, HTTP metodu, yanıt kodu; (b) Kimlik doğrulama logları: başarılı/başarısız giriş denemeleri, MFA doğrulamaları, oturum oluşturma/sonlandırma olayları; (c) İşlem logları: kullanıcı eylemleri, veri erişim kayıtları, hesaplama talepleri; (d) Hata logları: uygulama hataları, sistem istisnaları, performans anormallikleri; (e) Güvenlik logları: şüpheli aktiviteler, rate limiting tetiklenmeleri, yetkisiz erişim denemeleri. Log kayıtları, 5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun gereğince en az 2 (iki) yıl süreyle saklanır.
          </p>

          {/* MADDE 22 */}
          <h2>MADDE 22 – ANONİMLEŞTİRME VE TAKMA AD KULLANIMI</h2>
          <p>
            Platform, veri minimizasyonu ilkesi doğrultusunda, kişisel verilerin mümkün olan en erken aşamada anonimleştirilmesi veya takma adla (pseudonymization) değiştirilmesi yöntemlerini uygulamaktadır. Anonimleştirme, kişisel verilerin başka verilerle eşleştirerek dahi kimliği belirli veya belirlenebilir bir gerçek kişiyle ilişkilendirilememesi durumuna getirilmesidir. Anonimleştirilmiş veriler KVKK kapsamında kişisel veri sayılmaz ve bu Politika hükümleri anonim verilere uygulanmaz. Takma ad kullanımı ise, ek bilgi kullanılmaksızın kişisel verilerin belirli bir kişiyle ilişkilendirilememesi durumunu ifade eder; ancak bu yöntemle işlenen veriler hâlâ kişisel veri statüsündedir.
          </p>

          {/* MADDE 23 */}
          <h2>MADDE 23 – API ERİŞİMİ VE VERİ ENTEGRASYONLARı</h2>
          <p>
            Platform, B2B müşterilerine API aracılığıyla entegrasyon imkanı sunmaktadır. API erişimi kapsamında: (a) Her API çağrısı, kimlik doğrulama tokenı (JWT) ile yetkilendirilir; (b) API çağrı logları, güvenlik ve faturalama amacıyla saklanır; (c) Rate limiting uygulanarak hizmet reddi saldırılarına karşı koruma sağlanır; (d) API aracılığıyla iletilen tüm veriler TLS 1.3 şifreleme ile korunur; (e) API kullanıcıları, veri işleme sözleşmesi (DPA) imzalamakla yükümlüdür; (f) API anahtarları kriptografik olarak hashlenmiş biçimde saklanır ve düz metin olarak ifşa edilmez; (g) API kullanım kotaları ve erişim düzeyleri, kullanıcının abonelik planına göre belirlenir.
          </p>

          {/* MADDE 24 */}
          <h2>MADDE 24 – FELAKET KURTARMA VE İŞ SÜREKLİLİĞİ</h2>
          <p>
            Platform, kişisel verilerin korunmasını sağlamak üzere kapsamlı bir felaket kurtarma ve iş sürekliliği planı uygulamaktadır. Bu plan şunları kapsar: (a) Veritabanının düzenli olarak yedeklenmesi (günlük tam yedekleme, saatlik artımlı yedekleme); (b) Yedeklerin coğrafi olarak farklı lokasyonlarda şifreli olarak saklanması; (c) Felaket senaryolarında hizmetin en fazla 4 saat içinde yeniden devreye alınması hedefi (RTO); (d) En fazla 1 saatlik veri kaybı toleransı (RPO); (e) Yılda en az iki kez felaket kurtarma tatbikatı yapılması; (f) Yedek verilere yetkisiz erişimin önlenmesi için ayrı erişim kontrol mekanizmaları.
          </p>

          {/* MADDE 25 */}
          <h2>MADDE 25 – OTURUM YÖNETİMİ VE GÜVENLİK</h2>
          <p>
            Platform, kullanıcı oturumlarının güvenliğini sağlamak amacıyla aşağıdaki önlemleri almaktadır: (a) Oturum tokenları JWT (JSON Web Token) standardında, RS256 veya HS256 algoritmaları ile imzalanır; (b) Access token süresi 15-30 dakika, refresh token süresi 7-30 gün ile sınırlıdır; (c) Her yeni oturum için benzersiz oturum tanımlayıcı oluşturulur; (d) Eşzamanlı oturum sayısı sınırlandırılabilir; (e) Şüpheli aktivite tespit edilmesi halinde tüm oturumlar otomatik olarak sonlandırılır; (f) Oturum bilgileri httpOnly ve secure bayrağı ile korunur; (g) CSRF koruması uygulanır; (h) Belirli bir süre hareketsizlik sonrasında oturum otomatik olarak sonlandırılır.
          </p>

          {/* MADDE 26 */}
          <h2>MADDE 26 – PAROLA POLİTİKASI</h2>
          <p>
            Platform, kullanıcı hesaplarının güvenliğini sağlamak amacıyla aşağıdaki parola politikasını uygulamaktadır: (a) Minimum parola uzunluğu 8 karakterdir; (b) Parolalar bcrypt veya Argon2id algoritması ile hashlenmiş olarak saklanır, düz metin olarak saklanmaz; (c) İki faktörlü kimlik doğrulama (2FA/MFA) opsiyonel olarak sunulur ve TOTP standardını destekler; (d) Belirli sayıda başarısız giriş denemesi sonrasında hesap geçici olarak kilitlenir (rate limiting); (e) Parola değişikliği işlemlerinde mevcut parolanın doğrulanması zorunludur; (f) Parola sıfırlama tokenları zaman sınırlıdır ve tek kullanımlıktır; (g) Sızdırılmış parola veritabanlarına (Have I Been Pwned vb.) karşı kontrol yapılması değerlendirme altındadır.
          </p>

          {/* MADDE 27 */}
          <h2>MADDE 27 – E-POSTA GÜVENLİĞİ</h2>
          <p>
            Platform tarafından gönderilen tüm e-postalarda güvenlik standartlarına uyulur: (a) E-posta sunucuları TLS şifreleme ile korunur; (b) SPF, DKIM ve DMARC kayıtları yapılandırılarak e-posta sahteciliği önlenir; (c) E-posta doğrulama tokenları tek kullanımlıktır ve belirlenen süre sonunda geçersiz hale gelir; (d) Hassas bilgiler e-posta ile düz metin olarak iletilmez; link üzerinden güvenli platforma yönlendirme yapılır; (e) E-posta iletim logları, hizmet sağlayıcı tarafından 90 gün süreyle saklanır; (f) Oltalama (phishing) saldırılarına karşı kullanıcılar uyarılır ve platformdan gelen e-postalar marka tutarlılığı ile tanımlanabilir kılınır.
          </p>

          {/* MADDE 28 */}
          <h2>MADDE 28 – ERİŞİM KONTROLÜ VE YETKİLENDİRME</h2>
          <p>
            Platform, rol tabanlı erişim kontrolü (RBAC) uygulayarak kişisel verilere erişimi sınırlandırmaktadır. Mevcut kullanıcı rolleri: (a) Admin – tam sistem erişimi, kullanıcı yönetimi, sistem konfigürasyonu; (b) Premium User – gelişmiş özellikler, detaylı raporlama, API erişimi; (c) Pro User – standart özellikler, sınırlı API erişimi; (d) Free User – temel özellikler, kısıtlı veri erişimi. Her rol, minimum yetki ilkesi (principle of least privilege) doğrultusunda yalnızca görevinin gerektirdiği verilere erişim hakkına sahiptir. Erişim hakları düzenli olarak gözden geçirilir ve güncellenir. Tüm yetkili erişimler denetim loglarına kaydedilir.
          </p>

          {/* MADDE 29 */}
          <h2>MADDE 29 – KVKK UYUMLULUK PROGRAMI</h2>
          <p>
            Platform, KVKK ve ilgili mevzuat ile tam uyumu sürdürmeye yönelik kapsamlı bir uyumluluk programı yürütmektedir. Bu program: (a) VERBİS (Veri Sorumluları Sicil Bilgi Sistemi) kaydının güncel tutulması; (b) Kişisel veri envanter ve işleme süreçlerinin belgelenmesi; (c) Veri İşleme Etki Değerlendirmesi (DPIA) çalışmalarının yapılması; (d) Aydınlatma metinlerinin güncel tutulması; (e) Açık rıza beyanlarının mevzuata uygun biçimde alınması ve saklanması; (f) Veri işleme sözleşmelerinin üçüncü taraflarla imzalanması; (g) Periyodik iç denetim ve uyumluluk değerlendirmeleri; (h) Kişisel veri ihlal müdahale planının güncel tutulması; (i) Çalışan farkındalık eğitimlerinin düzenlenmesi kapsamındaki faaliyetleri içerir. Uyumluluk programı, mevzuat değişiklikleri ve Kurul kararları doğrultusunda düzenli olarak güncellenir.
          </p>

          {/* MADDE 30 */}
          <h2>MADDE 30 – VERİ ETKİ DEĞERLENDİRMESİ (DPIA)</h2>
          <p>
            Kişisel verilerin işlenmesinin bireylerin hak ve özgürlükleri üzerinde yüksek risk oluşturma ihtimalinin bulunduğu durumlarda, Platform veri koruma etki değerlendirmesi (DPIA – Data Protection Impact Assessment) gerçekleştirmektedir. DPIA, yeni bir veri işleme faaliyeti başlatılmadan önce veya mevcut işleme faaliyetlerinde önemli değişiklikler yapılmadan önce uygulanır. Değerlendirme; işleme faaliyetinin sistematik tanımı, amaçların orantılılık değerlendirmesi, risk analizi, risk azaltma tedbirleri ve istisnai durum planlarını kapsar. DPIA sonuçları belgelenir ve gerektiğinde Kişisel Verileri Koruma Kurulu ile paylaşılır.
          </p>

          {/* MADDE 31 */}
          <h2>MADDE 31 – E-POSTA DOĞRULAMA VE HESAP AKTİVASYONU</h2>
          <p>
            Platform güvenliğini artırmak ve spam hesapların önüne geçmek amacıyla, kayıt işleminin tamamlanması için e-posta doğrulama zorunlu tutulmaktadır. Kayıt sırasında girilen e-posta adresine bir doğrulama bağlantısı gönderilir. Bu bağlantı belirli bir süre (genellikle 24-48 saat) geçerlidir. Doğrulama tamamlanmadan hesap, tam işlevsellikle kullanılamaz. Doğrulama e-postasının yeniden gönderilmesi talep edilebilir. E-posta adresi değişikliği yapıldığında yeni adresin doğrulanması da zorunludur. Bu süreçte toplanan veriler sadece hesap güvenliği amacıyla kullanılır.
          </p>

          {/* MADDE 32 */}
          <h2>MADDE 32 – GİZLİLİK POLİTİKASI ONAY MEKANİZMASI</h2>
          <p>
            Platform&apos;a kayıt olurken tüm kullanıcılardan, işbu Gizlilik ve Çerez Politikası&apos;nı okuduklarına ve kabul ettiklerine dair açık onay alınmaktadır. Bu onay: (a) Kayıt formunda &quot;Gizlilik Politikasını okudum ve kabul ediyorum&quot; kutucuğunun işaretlenmesi suretiyle alınır; (b) Onay olmaksızın kayıt işlemi tamamlanamaz; (c) Onay tarihi, saati ve onay veren kullanıcının IP adresi dahil olmak üzere kayıt altına alınır; (d) Bu onay kaydı, Platform veritabanında güvenli biçimde saklanır ve yasal delil niteliğindedir; (e) Kullanıcı, onayını dilediği zaman geri çekme hakkına sahiptir; ancak onayın geri çekilmesi, onaya dayalı hizmetlerin sunulmasının kısmen veya tamamen durdurulmasına yol açabilir; (f) Gizlilik politikasında önemli değişiklikler yapılması halinde, kullanıcılardan yeniden onay alınması değerlendirilecektir.
          </p>

          {/* MADDE 33 */}
          <h2>MADDE 33 – UYUŞMAZLIK ÇÖZÜMÜ VE YETKİLİ MAHKEME</h2>
          <p>
            İşbu Politika&apos;dan kaynaklanan veya Politika ile bağlantılı tüm uyuşmazlıkların çözümünde öncelikle dostane yollar (müzakere, arabuluculuk) denenecektir. Uyuşmazlığın dostane yollarla çözümlenememesi halinde, Türkiye Cumhuriyeti kanunları uygulanacak ve İstanbul Mahkemeleri ve İcra Daireleri münhasıran yetkili olacaktır. GDPR kapsamındaki uyuşmazlıklarda, ilgili kişinin ikamet ettiği AEA üye devletindeki denetim makamına başvuru hakkı saklıdır. Platform, yargılama süreci boyunca ilgili kişisel verileri mevzuatın izin verdiği ölçüde saklamaya devam edecektir.
          </p>

          {/* MADDE 34 */}
          <h2>MADDE 34 – POLİTİKA DEĞİŞİKLİKLERİ VE BİLDİRİM</h2>
          <p>
            İşbu Politika, herhangi bir zamanda Bondley tarafından tek taraflı olarak değiştirilebilir, güncellenebilir veya yeniden düzenlenebilir. Politika değişiklikleri: (a) Platform üzerinde güncellenmiş metnin yayımlanması ile yürürlüğe girer; (b) Önemli değişikliklerde kayıtlı e-posta adresine bildirim gönderilebilir; (c) Değişiklik tarihi, Politika&apos;nın başında &quot;Son Güncelleme&quot; tarihi olarak gösterilir; (d) Değişiklik sonrasında Platform&apos;un kullanılmaya devam edilmesi, güncellenmiş Politika&apos;nın kabul edildiği anlamına gelir; (e) Önceki Politika versiyonlarına erişim imkanı sağlanması değerlendirilecektir; (f) Kullanıcıların Politika&apos;yı düzenli olarak gözden geçirmesi kendi sorumluluğundadır. Bondley, Politika değişikliklerinin zamanlaması, kapsamı ve sıklığı konusunda tam takdir yetkisine sahiptir.
          </p>

          {/* MADDE 35 */}
          <h2>MADDE 35 – YÜRÜRLÜK VE BÜTÜNLÜK</h2>
          <p>
            İşbu Gizlilik ve Çerez Politikası, Platform üzerinde yayımlandığı tarihte yürürlüğe girer ve aksine bir bildirim yapılmadıkça süresiz olarak yürürlükte kalır. Politika&apos;nın herhangi bir maddesinin yetkili bir mahkeme veya düzenleyici otorite tarafından geçersiz veya uygulanamaz bulunması halinde, söz konusu madde Politika&apos;dan bağımsız olarak değerlendirilir ve diğer maddelerin geçerliliğini etkilemez. Geçersiz bulunan madde, hükmün amacına en yakın biçimde yorumlanarak uygulanacaktır. Bu Politika, kişisel verilerin korunmasına ilişkin olarak Platform ile kullanıcı arasındaki ilişkiyi düzenleyen temel belge niteliğindedir ve Platform Kullanım Koşulları ile birlikte değerlendirilir.
          </p>

          {/* FINAL RESERVATION BLOCK */}
          <div className="mt-16 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-6">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <div>
                <p className="text-[14px] font-bold text-amber-700 dark:text-amber-300 !mt-0">
                  DEĞİŞİKLİK HAKKI TEKRAREN BEYAN
                </p>
                <p className="text-[13px] text-amber-700/90 dark:text-amber-300/80 !mb-0 mt-2">
                  Hizmet Verici Kurum olan Bondley, işbu Gizlilik ve Çerez Politikası&apos;nın tamamı veya herhangi bir maddesi üzerinde, önceden herhangi bir bildirimde bulunma yükümlülüğü olmaksızın, tek taraflı olarak değişiklik yapma, güncelleme, kaldırma, ek hükümler ekleme veya mevcut hükümleri tamamen yeniden düzenleme hakkını münhasıran saklı tutmaktadır. Bu hak, Platform&apos;un faaliyette olduğu tüm süre boyunca geçerlidir ve kullanıcıların söz konusu değişiklikleri düzenli olarak takip etmesi kendi sorumluluklarındadır. Güncellenen politikanın yürürlük tarihi, Platform üzerinde ilan edildiği tarihtir. Platform&apos;un kullanılmaya devam edilmesi, değişikliklerin bütünüyle kabul edildiği anlamını taşır.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-12 pt-8 border-t border-border/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[13px] text-muted-foreground">
              <p className="!mb-0">
                 Bu politika 35 madde halinde düzenlenmiş olup, tüm maddeleri tek bir bütünlük içinde yorumlanmalıdır.
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
