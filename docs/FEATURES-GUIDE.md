# FinCalc Yeni Özellikler ve Kullanım Kılavuzu

Sistemin güncel mimarisiyle birlikte uygulamaya eklenen tüm özellikler bu dokümanda detaylandırılmıştır. Bu doküman hem son kullanıcılar hem de sistem yöneticileri (admin) için rehber niteliğindedir.

---

## 1. E-posta Aktivasyonu ve Doğrulama Sistemi

Kullanıcıların sisteme sadece geçerli bir e-posta adresiyle kayıt olmalarını sağlamak ve yetkisiz veya bot hesapları engellemek amacıyla **E-posta Doğrulama Sistemi** devreye alınmıştır.

### 1.1. Nasıl Çalışır? (Son Kullanıcı Perspektifi)

1. **Kayıt Olma (Sign Up):** Bir kullanıcı uygulamaya kayıt olduğunda arka planda otomatik olarak "Üyeliğini Doğrula" başlıklı bir e-posta gönderilir. E-postanın içerisinde özel ve benzersiz bir **doğrulama token'ı (JWT)** bulunur.
2. **Doğrulama Linkine Tıklama:** Kullanıcı bu linke tıkladığında, uygulamanın `/verify-email` rotasına yönlendirilir ve token arka planda API'ye iletilir.
3. **API Onayı:** FastAPI backend `is_email_verified` durumunu `true` olarak günceller ve kullanıcıya başarılı olduğuna dair bir mesaj verir. 
4. **Hesap Kısıtlaması:** E-posta adresini doğrulamayan kullanıcılar belirli API uç noktalarına veya sayfalara erişmek istediklerinde "E-posta onaylanmadı" hatasıyla karşılaşabilir veya onaylama yapana kadar işlemi tamamlayamayabilirler (gelecekteki kısıtlamalar doğrultusunda).
5. **Kodun Yeniden Gönderilmesi:** Eğer e-posta kullanıcıya ulaşmadıysa veya token'ın süresi (varsayılan 24 saat) dolduysa, Giriş/Kayıt veya Doğrulama sayfasındaki **"Kodu Tekrar Gönder"** butonuyla yeniden bir aktivasyon linki talep edebilirler.

### 1.2. Teknik Detaylar (Yönetici & Geliştirici Perspektifi)

* **Tablo Güncellemesi:** `users` tablosuna `is_email_verified` (boolean) kolonu eklenmiştir.
* **SMTP Config:** Arka planda FastAPI Mail veya standart `smtplib` üzerinden e-postalar gönderilmekte olup `.env` dosyasındaki asenkron SMTP bilgileri kullanılmaktadır:
  * `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`.
* **Güvenlik:** Doğrulama token'ı JWT alt yapısı kullanılarak imza ile (`SECRET_KEY`) korunmaktadır. Token'a kullanıcının ID'si (`sub` field) işlenir. Bu sayede sadece doğru linke tıklanarak doğru hesap eşleştirilebilir.
* **Endpointler:** 
  * `POST /api/v1/auth/verify-email`
  * `POST /api/v1/auth/resend-verification`

---

## 2. Bakım Modu (Site Under Construction)

FinCalc platformunun altyapısında güncellemeler yaparken veya kritik veritabanı kesintilerinde müşterilerin işlem yapmasını engelleyerek sadece Sistem Yöneticilerinin (Admin) erişimine izin veren moddur.

### 2.1. Nasıl Çalışır? (Son Kullanıcı Perspektifi)

* Bakım modu aktif edildiği anda, siteye dışarıdan giren herhangi bir kullanıcı (giriş yapmış veya yapmamış) doğrudan `/maintenance` (Bakımdayız) sayfasına yönlendirilir.
* Müşteriye "Sistemimizde şu anda planlı bir bakım çalışması yürütülmektedir." şeklinde açıklayıcı bir uyarı mesajı gösterilir.
* Bu durumdayken sistemdeki formlar, veri çağrıları ve API'ler kilitli gibi davranır (UI üzerinden erişilemez).

### 2.2. Nasıl Çalışır? (Yönetici / Admin Perspektifi)

1. **Aktivasyon:** Yönetici haklarına sahip bir hesapla ("Role = admin") giriş yapıldığında, **Dashboard > Yönetim Paneli** sayfasındaki **"Sistem Durumu"** bölümüne girilir.
2. **Toggle (Aç/Kapat):** Burada yer alan "Bakım Modu" anahtarını (switch) kullanarak bakım modunu anında tüm uygulama genelinde aktif veya pasif yapabilirsiniz.
3. **Özel Erişim:** Bakım modunu sadece siz açabildiğiniz için sistem aktif olduğunda **adminler site içerisinde serbestçe gezmeye devam edebilirler**. Adminler için ekranın herhangi bir yerinde (layout) uyarı amaçlı "DİKKAT: Site şu anda Bakım Modunda" yazan **kırmızı bir banner** belirir.

### 2.3. Teknik Detaylar (Yönetici & Geliştirici Perspektifi)

* **`system_settings` Tablosu:** Uygulamaya ait genel ayarlar için veritabanında `system_settings` tablosu oluşturulmuştur (Key-Value yapısı ile tasarlanmıştır). 
  * **Key:** `maintenance_mode`
  * **Value:** `"true"` veya `"false"`
* **API Cache & Optimizasyonu:** `GET /api/v1/system/maintenance` isteği hızlı yanıt dönmesi için statüsünü önbellekten alacak şekilde veya basit query ile çözülür.
* **Next.js Frontend Guard:** Uygulamanın en kök dosyası olan `layout.tsx` dosyasında özel bir `<MaintenanceGuard>` render edilir.
  * Router pathname değiştiği anda mevcut status kontrol edilir. Eğer açık ve kişi Admin değil ise doğrudan `router.replace("/maintenance")` fonksiyonunu çalıştırır.
* **Endpointler:**
  * `POST /api/v1/admin/maintenance` (Sadece yetkili adminler çağırabilir)
  * `GET /api/v1/system/maintenance` (Herkese açık sistem kontrol servisi)
* **Loglama:** Sistemin bakım moduna alındığı ve bakım modundan çıkartıldığı vakitler `audit_logs` tablosuna (Audit Service aracılığıyla) Admin aksiyonu olarak işlenir. Böylece geçmişe dönük sistem kesintileri izlenebilir.

---

## 3. Onboarding Akışı (Kullanıcı Profil Oluşturma)

Yeni kaydolan kullanıcıların sisteme ilk girişlerindeprofillerini tamamlamaları için özel bir **Onboarding Akışı** uygulanmaktadır. Bu sayede kullanıcıların ihtiyaçlarına daha iyi yanıt verebilir ve sistem deneyimi kişiselleştirilebilir.

### 3.1. Nasıl Çalışır? (Son Kullanıcı Perspektifi)

1. **Otomatik Yönlendirme:** Kayıt işlemini tamamlayıp giriş yapan yeni bir kullanıcı, ilk authenticate olduktan hemen sonra **/onboarding** sayfasına yönlendirilir.
2. **Profil Bilgileri:** Kullanıcıdan aşağıdaki bilgiler talep edilir:
   * **Departman (Department):** Kullanıcının çalıştığı departman/sektör (örneğin: Finans, Muhasebe, Yatırım, vb.)
   * **Meslek (Job Title):** Pozisyonu veya mesleği
   * **Kullanım Amacı (Usage Purpose):** Sistemi ne için kullanacağı (örneğin: Kişisel yatırım, şirket portföyü, müşteri danışmanlığı, vb.)
   * **Tahmini Günlük Görüntüleme (Estimated Daily Views):** Günde kaç kez sistemi kullanmayı planladığı
3. **Tamamlama:** Bilgiler doldurulup "Profili Tamamla" butonuna basıldığında:
   * Backend'e `profile_completed` alanı `true` olarak güncellenir.
   * Kullanıcı normal dashboard'a (`/dashboard`) yönlendirilir.
4. **Sonraki Girişler:** Profili tamamlamış kullanıcılar bir daha onboarding akışına girmezler; doğrudan dashboard'a yönlendirilirler.

### 3.2. Teknik Detaylar (Yönetici & Geliştirici Perspektifi)

* **Tablo Yapısı:** `users` tablosuna eklenen alanlar:
  * `department` (varchar/string) - Kullanıcının departmanı
  * `job_title` (varchar/string) - Meslek/Pozisyon
  * `usage_purpose` (varchar/string) - Kullanım amacı
  * `estimated_daily_views` (integer) - Tahmini günlük görüntüleme sayısı
  * `profile_completed` (boolean) - Profil tamamlandı mı?
* **Frontend Guard:** `OnboardingGuard` bileşeni, `profile_completed === false` olan kullanıcıları yakalar ve onboarding sayfasına yönlendirir.
* **Endpointler:**
  * `POST /api/v1/users/complete-profile` - Profil bilgilerini kaydeder
  * `GET /api/v1/users/me` - Mevcut kullanıcı bilgilerini döndürür (profile_completed durumu dahil)

---

## 4. MFA / Çok Faktörlü Kimlik Doğrulama

Hesap güvenliğini artırmak amacıyla FinCalc, kullanıcılara **MFA (Multi-Factor Authentication)** özelliği sunmaktadır. Bu özellik ile kullanıcılar, e-posta ve şifrelerine ek olarak ikinci bir kimlik doğrulama katmanı ekleyebilirler.

### 4.1. Nasıl Çalışır? (Son Kullanıcı Perspektifi)

#### 4.1.1 MFA'yı Etkinleştirme

1. **Kurulum Başlatma:** Kullanıcı, hesap ayarlarından veya güvenlik bölümünden **"MFA Kur"** butonuna tıklar.
2. **Authenticator Uygulaması:** Kullanıcıya bir QR kod gösterilir. Bu kod, Google Authenticator, Authy, Microsoft Authenticator gibi **TOTP tabanlı** bir authenticator uygulaması ile taranır.
3. **Doğrulama Kodu:** Tarama sonrası authenticator uygulamasında 6 haneli bir kod oluşur. Kullanıcı bu kodu "Doğrula" alanına girer.
4. **Yedek Kodlar:** Kurulum başarılı olursa, sistem otomatik olarak **10 adet yedek kod (backup codes)** oluşturur ve bunları kullanıcıya gösterir.
   * **ÖNEMLİ:** Bu kodlar bir kez gösterilir ve bir kez kaydedilir. Kullanıcı bunları güvenli bir yere (örneğin şifre yöneticisi) kaydetmelidir.
5. **Aktivasyon:** Doğrulama başarılı olduğunda `users.mfa_enabled = true` ve `users.mfa_secret_encrypted` alanları güncellenir.

#### 4.1.2 MFA ile Giriş

1. Kullanıcı e-posta ve şifresini girer.
2. Normal giriş başarılı olduğunda, MFA doğrulama sayfasına (`/mfa-verify`) yönlendirilir.
3. Kullanıcı authenticator uygulamasından 6 haneli kodu girer.
4. Alternatif olarak, kayıptan önceki "Yedek Kod kullan" seçeneğiyle yedek kod da girilebilir.

#### 4.1.3 MFA'yı Devre Dışı Bırakma

1. Kullanıcı hesap ayarlarından **"MFA Kapat"** butonuna tıklar.
2. Güvenlik onayı olarak mevcut şifresi tekrar girilir.
3. MFA devre dışı kalır ve kullanıcı normal giriş akışına geri döner.

### 4.2. Teknik Detaylar (Yönetici & Geliştirici Perspektifi)

* **Tablo Yapısı:** `users` tablosuna eklenen alanlar:
  * `mfa_enabled` (boolean) - MFA etkin mi?
  * `mfa_secret_encrypted` (varchar) - Encrypted TOTP secret
  * `backup_codes` (json/array) - Hash'lenmiş yedek kodlar
* **TOTP Kütüphanesi:** `pyotp` veya `speasyotp` kullanılmaktadır.
* **Secret Şifreleme:** MFA secret, `SECRET_KEY` kullanılarak AES şifreleme ile veritabanında saklanır.
* **Yedek Kod Güvenliği:** Yedek kodlar SHA-256 hash'lenerek saklanır (plain text asla tutulmaz).
* **Endpointler:**
  * `POST /api/v1/auth/mfa/setup` - MFA kurulumunu başlatır (secret üretir)
  * `POST /api/v1/auth/mfa/confirm` - İlk doğrulama ile MFA'yı etkinleştirir
  * `POST /api/v1/auth/mfa/verify` - MFA kodunu doğrular (giriş veya herhangi bir işlem için)
  * `POST /api/v1/auth/mfa/disable` - MFA'yı devre dışı bırakır
  * `GET /api/v1/auth/mfa/status` - MFA durumunu döndürür

---

## 5. Yönetim Paneli (Admin Interface)

FinCalc, sistem yöneticileri (admin rolüne sahip kullanıcılar) için kapsamlı bir yönetim paneli sunmaktadır. Bu panel `/admin` rotası altında erişilebilir ve çeşitli yönetim modüllerinden oluşur.

### 5.1. Nasıl Çalışır? (Yönetici Perspektifi)

Yönetim paneline erişmek için hesabınızın `role = 'admin'` olması gerekmektedir. Admin hesabıyla giriş yapıldığında sol menüde **"Yönetim Paneli"** linki belirir.

#### 5.1.1 /admin/users — Kullanıcı Yönetimi

Sisteme kayıtlı tüm kullanıcıları görüntüleme, düzenleme ve yönetme alanıdır.
* **Özellikler:**
  * Tüm kullanıcıların listesini görüntüle (sayfalama ile)
  * Kullanıcı rolünü değiştir (user / admin)
  * Kullanıcı hesap durumunu değiştir (aktif / askıda / blocked)
  * E-posta doğrulama durumunu görüntüle
  * MFA durumunu görüntüle
  * Kullanıcı silme (soft delete)
* **Arama:** E-posta veya kullanıcı adına göre arama yapılabilir.

#### 5.1.2 /admin/bonds — Tahvil/Bond Yönetimi

Sistemdeki BIST tahvillerinin ve bono verilerinin yönetildiği bölümdür.
* **Özellikler:**
  * Tüm bond verilerini listele
  * Bond bilgilerini görüntüle (ISIN, vade, faiz oranı, fiyat)
  * Bond ekleme / güncelleme / silme (CRUD)
  * Veri yenileme (refresh) işlemleri

#### 5.1.3 /admin/metrics — Sistem Metrikleri Dashboard

Sistemin genel performansını ve kullanım istatistiklerini gösteren dashboard.
* **Özellikler:**
  * Toplam kullanıcı sayısı
  * Aktif kullanıcı sayısı (son 7/30 günde aktif olanlar)
  * E-posta doğrulanmış kullanıcı oranı
  * MFA etkinleştirilmiş kullanıcı sayısı
  * Toplam bond sayısı
  * Sistem uptime bilgisi
  * API istek sayıları (opsiyonel)

#### 5.1.4 /admin/logs — Denetim Kayıtları (Audit Logs)

Sistemde gerçekleşen tüm önemli olayların ve kullanıcı aksiyonlarının loglandığı bölümdür.
* **Özellikler:**
  * Tüm audit kayıtlarını listele
  * Filtreleme: Tarih aralığı, kullanıcı, aksiyon tipi
  * Detaylı log görüntüleme
* **Loglanan Olaylar:**
  * Kullanıcı giriş/çıkış
  * Profil güncellemeleri
  * MFA kurulum/kapatma
  * Admin aksiyonları (kullanıcı düzenleme, sistem ayarları)
  * Bakım modu açma/kapama

#### 5.1.5 /admin/notifications — Bildirim Yönetimi

Tüm kullanıcılara veya belirli kullanıcı gruplarına toplu bildirim gönderme.
* **Özellikler:**
  * Yeni duyuru oluştur (başlık + içerik)
  * Hedef kitle seçimi (tüm kullanıcılar / belirli gruplar)
  * Bildirim gönderimi (e-posta ve/veya sistem içi bildirim)
  * Gönderim tarihçesi

#### 5.1.6 /admin/import — Veri İçe Aktarma

Sisteme toplu veri aktarma işlemleri için ayrılmış bölüm.
* **Özellikler:**
  * **BIST Verileri:** BIST borsasına ait verilerin içe aktarılması (şu anda yalnızca BIST desteği mevcuttur)
  * CSV/Excel formatında veri yükleme
  * Veri doğrulama ve önizleme
  * İçe aktarma onayı

> **Bilgi:** Şu anda sadece BIST veri içe aktarımı desteklenmektedir. Diğer borsalar için destek planlanmaktadır.

#### 5.1.7 /admin/sentry-debug — Hata Testi

Sentry entegrasyonunun test edilmesi ve hata raporlama sisteminin doğrulanması için ayrılmış bölüm.
* **Özellikler:**
  * Manuel hata tetikleme (test amaçlı)
  * Hata raporunun Sentry'ye ulaşıp ulaşmadığını doğrulama
  * Hata ayıklama (debug) modu

### 5.2. Teknik Detaylar (Geliştirici Perspektifi)

* **Rota Koruma:** Tüm `/admin/*` rotaları `RoleGuard` ile korunur. Sadece `role = 'admin'` olan kullanıcılar erişebilir.
* **Sidebar:** Admin专属 sidebar menu tanımları `app/admin/layout.tsx` içinde yapılmıştır.
* **Endpointler:** Her modülün kendine ait API endpointleri mevcuttur:
  * `GET/POST/PUT/DELETE /api/v1/admin/users`
  * `GET/POST/PUT/DELETE /api/v1/admin/bonds`
  * `GET /api/v1/admin/metrics`
  * `GET /api/v1/admin/logs`
  * `POST /api/v1/admin/notifications`
  * `POST /api/v1/admin/import`
  * `POST /api/v1/admin/test-sentry`

---

## 6. Kullanıcı Dashboard Özellikleri

FinCalc kullanıcıları, giriş yaptıktan sonra kişisel dashboard'ları üzerinden çeşitli özelliklere erişebilirler. Bu bölüm `/dashboard` rotası altında sunulan özellikleri açıklar.

### 6.1. Nasıl Çalışır? (Kullanıcı Perspektifi)

Dashboard'a giriş yaptıktan sonra sol menüden veya ana sayfadan erişilebilen çeşitli alt bölümler mevcuttur:

#### 6.1.1 /dashboard/analytics — Analitik ve TLREF Grafikleri

Kullanıcıların portföy performansını ve piyasa verilerini analiz ettiği bölüm.
* **Özellikler:**
  * **TLREF Grafikleri:** Türk Lirası Referans Faiz oranlarının grafiksel gösterimi
  * **Kullanıcı Metrikleri:** Kendi yatırım performansı, kazanç/kayıp oranları
  * **Tarihsel Veri:** Seçilen zaman dilimine göre grafik (1Ay, 3Ay, 1Yıl, vb.)
  * **İndir:** Grafik veya veriyi CSV/PDF olarak indirme

#### 6.1.2 /dashboard/alerts — Uyarı ve Bildirim Yönetimi

Kullanıcıların oluşturduğu fiyat uyarıları ve sistem bildirimlerinin yönetildiği bölüm.
* **Özellikler:**
  * Yeni uyarı oluştur (fiyat, yüzde değişimi, vb.)
  * Mevcut uyarıları listele / düzenle / sil
  * Tetiklenen uyarıları görüntüle
  * Sistem bildirimlerini görüntüle
  * Bildirim ayarları (e-posta, push, vb.)

#### 6.1.3 /dashboard/settings — Hesap Ayarları

Kullanıcının kişisel hesap ayarlarını yönetdiği bölüm.
* **Özellikler:**
  * Profil bilgilerini güncelle (departman, meslek, kullanım amacı)
  * Şifre değiştirme
  * E-posta değiştirme
  * **MFA Ayarları:** MFA kurulumu, yedek kod görüntüleme, MFA kapatma
  * Bildirim tercihleri
  * Tema ayarları (varsa)
  * Hesap silme / deactivate

#### 6.1.4 /dashboard/favorites — Favoriler ve Kayıtlı Bondlar

Kullanıcının takip ettiği ve favorilerine eklediği tahvillerin listesi.
* **Özellikler:**
  * Bond listesinden favorilere ekle/çıkart
  * Favorileri listele
  * Favoriler arasında arama
  * Hızlı fiyat görüntüleme
  * Favorilere özel uyarı oluşturma

### 6.2. Teknik Detaylar (Geliştirici Perspektifi)

* **Alt Route Yapısı:** Dashboard altında sub-route'lar:
  * `/dashboard` (ana dashboard)
  * `/dashboard/analytics`
  * `/dashboard/alerts`
  * `/dashboard/settings`
  * `/dashboard/favorites`
* **Veri Koruma:** Kullanıcıya özel veriler her zaman JWT token'dan extract edilen `user_id` ile çekilir.
* **Endpointler (Örnek):**
  * `GET /api/v1/user/alerts`
  * `POST /api/v1/user/alerts`
  * `GET /api/v1/user/favorites`
  * `POST /api/v1/user/favorites`
  * `GET /api/v1/analytics/tlref`

---

## 7. Yasal Sayfalar (Legal Pages)

FinCalc platformunun yasal dokümanları ve iletişim bilgileri aşağıdaki sayfalarda sunulmaktadır. Bu sayfalar Türkçe olarak hazırlanmıştır.

### 7.1. /gizlilik — Gizlilik Politikası

Kullanıcıların kişisel verilerinin nasıl toplandığı, işlendiği ve korunduğu hakkında detaylı bilgileri içerir.
* **Kapsam:**
  * Toplanan veri türleri
  * Veri işleme amaçları
  * Veri saklama süreleri
  * Kullanıcı hakları (KVKK kapsamında)
  * Çerez (cookie) politikası

### 7.2. /kullanim-sartlari — Kullanım Şartları

FinCalc platformunun kullanım koşullarını ve kurallarını belirten yasal dokümandır.
* **Kapsam:**
  * Hizmetin kapsamı ve kullanım koşulları
  * Kullanıcı yükümlülükleri
  * Sorumluluk sınırları
  * Fikri mülkiyet hakları
  * Yasal uyuşmazlık çözümü

### 7.3. /iletisim — İletişim Bilgileri

FinCalc ekibi ile iletişime geçmek için kullanılabilecek kanalların listesi.
* **Kapsam:**
  * E-posta adresi
  * Telefon numarası (varsa)
  * Adres bilgisi
  * İletişim formu
  * Sosyal medya linkleri

### 7.4. Teknik Detaylar (Geliştirici Perspektifi)

* **Rota Tanımları:** Next.js App Router yapısında:
  * `/app/gizlilik/page.tsx`
  * `/app/kullanim-sartlari/page.tsx`
  * `/app/iletisim/page.tsx`
* **SEO:** Her sayfa için meta description ve title ayarlanmıştır.
* **Dil:** Tüm içerik Türkçe olarak sunulmaktadır.

---

## 8. Hızlı Başvuru (Quick Reference)

| Özellik | Rota | Açıklama |
|---------|------|----------|
| Kayıt | `/register` | Yeni kullanıcı kaydı |
| Giriş | `/login` | Kullanıcı girişi |
| onboarding | `/onboarding` | Yeni kullanıcı profil kurulumu |
| E-posta Doğrulama | `/verify-email` | E-posta aktivasyonu |
| MFA Doğrulama | `/mfa-verify` | İkinci faktör doğrulama |
| Bakım Modu | `/maintenance` | Site bakım sayfası |
| Kullanıcı Dashboard | `/dashboard` | Ana kullanıcı paneli |
| Analytics | `/dashboard/analytics` | TLREF ve metrikler |
| Uyarılar | `/dashboard/alerts` | Fiyat uyarıları |
| Ayarlar | `/dashboard/settings` | Hesap ayarları |
| Favoriler | `/dashboard/favorites` | Kayıtlı bondlar |
| Yönetim Paneli | `/admin` | Ana admin paneli |
| Kullanıcı Yönetimi | `/admin/users` | Kullanıcı CRUD |
| Bond Yönetimi | `/admin/bonds` | Bond CRUD |
| Metrikler | `/admin/metrics` | Sistem metrikleri |
| Denetim Kayıtları | `/admin/logs` | Audit logs |
| Bildirimler | `/admin/notifications` | Toplu bildirim |
| Veri İçe Aktarım | `/admin/import` | BIST veri import |
| Hata Testi | `/admin/sentry-debug` | Sentry test |
| Gizlilik Politikası | `/gizlilik` | KVKK dokümanı |
| Kullanım Şartları | `/kullanim-sartlari` | Yasal şartlar |
| İletişim | `/iletisim` | İletişim bilgileri |

---

*Bu doküman FinCalc v1.0+ sürümü için hazırlanmıştır. Güncel özellikler için her zaman bu dokümanı kontrol edin.*