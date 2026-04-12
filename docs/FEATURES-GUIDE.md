# FinCalc Yeni Özellikler ve Kullanım Kılavuzu

Sistemin güncel mimarisiyle birlikte uygulamaya eklenen temel özellikler (Email Doğrulama ve Bakım Modu) bu dokümanda detaylandırılmıştır. Bu doküman hem son kullanıcılar hem de sistem yöneticileri (admin) için rehber niteliğindedir.

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
