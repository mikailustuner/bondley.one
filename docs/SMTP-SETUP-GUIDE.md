# FinCalc E-posta Sistemi (SMTP) Kurulum ve Bağlantı Rehberi

FinCalc platformunda yeni üye olan kullanıcıların e-postalarını doğrulayabilmesi ve gerekli sistem bildirimlerinin iletilebilmesi için bir **SMTP (Simple Mail Transfer Protocol)** servisine ihtiyacınız bulunmaktadır. Bu rehberde, sistemi Docker üzerinde yayına aldığınız ortamda SMTP'yi nasıl ayarlayıp bağlayacağınız adım adım açıklanmıştır.

---

## 1. SMTP Sağlayıcısı Seçimi veya Temini

E-posta gönderebilmek için bir SMTP sunucusuna ihtiyacınız var. Farklı sağlayıcılar kullanabilirsiniz:

* **Sizin Zaten Sahip Olduğunuz (Örn: Hostinger, cPanel, vs.):** Kurumsal e-posta adresiniz var ise (örneğin info@fincalc.com) hosting paneliniz üzerinden SMTP bilgilerini öğrenebilirsiniz.
* **Ücretsiz ve Güvenilir Üçüncü Parti Servisler (GCP/AWS/DigitalOcean için ideal):**
  * **Resend (Önerilen):** Aylık 3.000 e-posta ücretsiz. Kendi alan adınızla (domain) çok hızlı entegre olur. Spama düşme oranı çok düşüktür.
  * **Brevo (Eski adıyla Sendinblue):** Günlük 300 e-posta ücretsiz (Aylık 9.000). Alan adınız üzerinden sorunsuz gönderim sağlar.
  * **MailerSend veya Mailgun:** İkisi de cömert ücretsiz plamlara sahiptir.
* **Tamamen Ücretsiz, Alan Adı Gerekmeden (Gmail):** Özel bir şirket mailiniz (alan adınız) yoksa, `uygulamaadi@gmail.com` gibi standart bir Gmail açıp "Uygulama Şifreleri (App Passwords)" ile gönderebilirsiniz. Günlük 500 mail limiti vardır ve başlangıç için son derece tatmin edicidir.

**İhtiyacınız Olan Bilgiler:**
* **`SMTP_HOST`**: SMTP sunucusunun adresi (örn. `smtp.hostinger.com` veya `smtp.resend.com`)
* **`SMTP_PORT`**: E-posta gönderim portu (Genellikle SSL için `465` veya TLS için `587`)
* **`SMTP_USER`**: SMTP giriş kullanıcı adınız (Genellikle gönderici e-posta adresinizin tamamı, örn. `noreply@fincalc.com`)
* **`SMTP_PASSWORD`**: E-posta şifreniz veya sağlayıcının verdiği **API Key / Uygulama Şifresi**
* **`SMTP_FROM_EMAIL`**: Alıcıların göreceği "Kimden" adresi (Genellikle `SMTP_USER` ile aynı olur)

---

## 2. Docker / Production `.env` Dosyasının Ayarlanması

Sistemi Debian sunucunuzda Docker üzerinden prodda (canlı ortam) ayağa kaldırırken kullandığınız `.env.production` (veya sunucudaki sadece `.env`) dosyasına bu ayarları girmelisiniz.

Terminalinizde (veya vim/nano gibi bir editörle) `.env` dosyanızı açın ve aşağıdaki ortam değişkenlerini yapınıza uygun olarak ekleyin veya düzenleyin:

```ini
# --- EMAIL / SMTP AYARLARI ---
SMTP_HOST="smtp.hostinger.com"         # Sunucunuzun adresi (Örn: smpt.gmail.com)
SMTP_PORT=465                          # Port (465 veya 587)
SMTP_USER="noreply@fincalc.com"        # Gönderici E-posta
SMTP_PASSWORD="SüperGizliŞifre123"     # Şifre (Hostinger vs ise gerçek şifre)
SMTP_FROM_EMAIL="noreply@fincalc.com"  # Son kullanıcıda görünecek mail
FRONTEND_URL="https://app.fincalc.com" # Burası çok önemli! Linklerin çalışması için doğru frontend adresiniz olmalı
```

### Örnek 1: Resend (Kendi Domain'iniz Varsa)
[Resend.com](https://resend.com/)'a kayıt olun. "Domains" kısmından alan adınızı (Örn: fincalc.com) ekleyin ve verdikleri DNS (TXT/MX) kayıtlarını GCP Cloud DNS'e veya domaini aldığınız yere girin. Ardından API Key oluşturun.

```ini
SMTP_HOST="smtp.resend.com"
SMTP_PORT=465
SMTP_USER="resend"
SMTP_PASSWORD="re_...sizin_api_anahtariniz..."
SMTP_FROM_EMAIL="noreply@sizin-alanadiniz.com"
```

### Örnek 2: Brevo / Sendinblue (Kendi Domain'iniz Varsa)
[Brevo.com](https://www.brevo.com/tr/)'a kayıt olun. Hesap Ayarları -> SMTP & API bölümünden yeni bir SMTP şifresi oluşturun ve Domain sekmesinden alan adınızı doğrulayın.

```ini
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT=587
SMTP_USER="kayitli_emailiniz@ornek.com"  # Brevo'ya kayıt olduğunuz mail
SMTP_PASSWORD="...brevodan_aldiginiz_smtp_sifresi..."
SMTP_FROM_EMAIL="info@sizin-alanadiniz.com"
```

### Örnek 3: Gmail (Domain'iniz YOKSA, En Hızlı Yöntem)
Özel alan adınız yoksa, Google üzerinden ücretsiz bir servis kurabilirsiniz:
1. Google hesabınızda "2 Adımlı Doğrulama"yı (2-Step Verification) açın.
2. [Google Hesap Güvenliği Ekranı](https://myaccount.google.com/apppasswords)'na girerek (veya arama kutusuna 'Uygulama şifreleri' yazarak) yeni bir şifre oluşturun (Uygulama adı: FinCalc seçebilirsiniz).
3. Size 16 haneli bir kod verecek, boşluksuz şekilde kopyalayın.

```ini
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="sizin.hesabiniz@gmail.com"
SMTP_PASSWORD="abcdefghijklmnop"  # 16 haneli uygulama şifresi (boşluksuz)
SMTP_FROM_EMAIL="sizin.hesabiniz@gmail.com"
```

---

## 3. Sistemi Yeni Ayarlarla Yeniden Başlatmak

Cihazınızda Docker-Compose çalışıyorsa, `.env` dosyasını güncelledikten sonra arka plandaki tüm servislerin (özellikle `fincalc-api` partisinin) yeni verilerle başlaması gerekir.

Sunucunuzda proje klasörüne girin (örn. `cd ~/FinCalc`) ve şu komutları sırasıyla çalıştırın:

```bash
# Servisleri durdurun (Veriler silinmez)
docker compose down

# Servisleri yeni .env dosyasıyla tekrar başlatın
docker compose up -d
```

Ya da hızlıca sadece API konteynerini yeniden başlatabilirsiniz (eğer composer dosyanız güncellenmediyse):

```bash
docker restart fincalc-api
```

---

## 4. Servisi Test Etmek

Bu kurulumun ardından e-posta gidip gitmediğini şu şekilde test edebilirsiniz:

1. **Frontend (/signup):** Frontend arayüzünüze girin. Yeni ve gerçek bir kişinin (kendi şahsi gmailiniz vb.) hesabını yaratın.
2. Formu doldurup gönderdiğinizde saniyeler içinde şahsi e-postanıza aktivasyon maili gelmelidir. (Mailin "Gereksiz (Spam)" klasörüne düşüp düşmediğini kontrol etmeyi unutmayın).
3. Gelen mailin içerisindeki token içeren bağlantının doğru adrese (`app.fincalc.com/verify-email?token=...`) yönlendirip yönlendirmediğini kontrol edin, bu bağlantı `.env` dosyanızdaki `FRONTEND_URL` ile birleştirilir.

### Eğer Mail Gitmiyorsa (Troubleshooting):
Docker üzerinden hata loglarını okuyarak sorunu çok net görebilirsiniz:

```bash
# API loglarında son hataları görmek için:
docker logs --tail 200 fincalc-api
```

Loglarda *"Authentication failed"*, *"Connection timeout"* veya *"Socket status"* gibi hatalar varsa; `.env` dosyasındaki şifrelerin veya port (465/587) ayarlarının yanlış olduğu anlamına gelir. 

*Not: Eğer 465 portu sıkıntı yaratıyorsa `SMTP_PORT=587` olarak deneyip API'yi yeniden başlatmanız tavsiye edilir.*
