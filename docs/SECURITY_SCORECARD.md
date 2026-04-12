# FinCalc Güvenlik Puan Kartı ve Detaylı Değerlendirme

**Tarih:** 2025-02-19  
**Kapsam:** Uygulama katmanı (API, Web), altyapı, kimlik doğrulama ve deployment  
**Yöntem:** Defense-in-depth, OWASP Top 10, CWE/CVE odaklı inceleme  

---

## Özet Puan: **72/100** (Orta–İyi)

| Kategori                    | Puan  | Ağırlık | Açıklama |
|----------------------------|-------|---------|----------|
| Kimlik doğrulama & yetkilendirme | 75/100 | 20% | Güçlü parola/JWT; token depolama ve MFA eksik |
| Giriş doğrulama & enjeksiyon   | 85/100 | 20% | ORM kullanımı, Pydantic; rate limit yok |
| Gizlilik yönetimi (secrets)    | 55/100 | 15% | Production doğrulama var; .env.production riski |
| Altyapı & ağ güvenliği        | 80/100 | 15% | TLS 1.2/1.3, HSTS, segmentasyon; WAF/rate limit yok |
| Güvenli yapılandırma          | 70/100 | 10% | CORS, header’lar; CSP ve ek header’lar eksik |
| Loglama & olay müdahalesi     | 50/100 | 10% | Temel loglama; SIEM/alerting yok |
| Bağımlılık & tedarik zinciri  | 70/100 | 5%  | Sabit sürüm yok; SBOM/otomatik tarama yok |
| Uyumluluk & dokümantasyon     | 85/100 | 5%  | Production checklist iyi; politika eksik |

*Ağırlıklı ortalama: ~72.*

---

## 1. Kimlik Doğrulama ve Yetkilendirme

### Güçlü Yönler
- **Parola:** bcrypt ile hash (max 72 byte UTF-8), tuz kullanımı.
- **JWT:** HS256, süre sınırı (`JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30`), `decode_access_token` ile doğrulama.
- **Production secret doğrulama:** `validate_production_secrets()` ile zayıf JWT/DB varsayılanları reddediliyor; en az 32 karakter JWT zorunlu.
- **Rol tabanlı erişim:** `get_admin_user` ile admin-only endpoint’ler korunuyor (`/admin/*`, `/bonds/sync`, `/tlref/sync-now`, `/import/*`).
- **Aktif kullanıcı kontrolü:** Login’de `user.is_active` kontrolü; token geçerli olsa bile pasif kullanıcı reddediliyor.
- **Şema doğrulama:** `UserCreate`/`PublicRegister` için `EmailStr`, parola min/max length (8–128).

### Zayıf Yönler / Riskler
- **Token depolama:** JWT `localStorage`’da (`fincalc_token`). XSS durumunda token çalınabilir. Dokümantasyonda da belirtilmiş; refresh token + httpOnly cookie önerilir.
- **MFA yok:** İki faktörlü doğrulama veya WebAuthn/FIDO2 yok.
- **Token iptali:** Blacklist veya Redis tabanlı iptal yok; süre dolana kadar token geçerli.
- **Admin seed:** Geliştirme ortamında `ADMIN_INIT_PASSWORD` boşsa `admin123` kullanılıyor; production’da boş bırakılırsa admin oluşturulmuyor (doğru davranış).

**Öneriler:** httpOnly cookie + refresh token rotasyonu; MFA (TOTP/WebAuthn); kritik işlemler için yeniden kimlik doğrulama.

---

## 2. Giriş Doğrulama ve Enjeksiyon

### Güçlü Yönler
- **SQL:** Sorgular SQLAlchemy ORM ve `select()` ile; kullanıcı girdisi doğrudan SQL metnine eklenmiyor. `bonds` listesinde `search`, `security_type`, `yield_type` filtreleri ORM `.ilike()` ile parametreli kullanılıyor.
- **Migration metinleri:** `main.py` içindeki `text()` çağrıları sabit/schema isimleri ve sabit sayılar (örn. `MIGRATION_LOCK_ID`); kullanıcı girdisi yok.
- **API girişleri:** FastAPI + Pydantic (örn. `CalculationRequest`, `UserLogin`, `PublicRegister`); tip ve uzunluk kısıtları var.
- **Path parametreleri:** `isin_code` gibi değerler ORM koşulunda kullanılıyor; raw string birleştirme yok.

### Zayıf Yönler / Riskler
- **Rate limiting yok:** Login/signup ve genel API için rate limit yok; brute-force ve DoS riski. PRODUCTION_CHECKLIST’te “opsiyonel” olarak belirtilmiş.
- **Arama/filtre sınırı:** `search`, `security_type`, `yield_type` için maksimum uzunluk veya karakter whitelist yok; aşırı uzun değerler performans riski (ORM parametreli olduğu için enjeksiyon riski düşük).

**Öneriler:** Nginx veya FastAPI middleware ile login/signup ve `/api/v1/` için rate limit; isteğe bağlı olarak arama parametreleri için max length/whitelist.

---

## 3. Gizlilik Yönetimi (Secrets)

### Güçlü Yönler
- **`.gitignore`:** `.env`, `.env.local`, `.env.production` ignore listesinde.
- **Production zorunlulukları:** `validate_production_secrets()` ile default JWT ve POSTGRES_PASSWORD production’da kabul edilmiyor.
- **Deploy script:** `deploy.sh` placeholder değerleri (`BURAYA_GUCLU_SIFRE_YAZ_32_KARAKTER` vb.) kontrol ediyor; gerçek parolalar log’lanmıyor.

### Kritik Uyarı
- **`.env.production` dosyası:** Workspace’te bu dosya mevcut ve içinde gerçek production secret’ları (DB, Redis, JWT) var. Bu dosya **asla** git’e commit edilmemeli. Eğer geçmişte bir kez commit edildiyse, PRODUCTION_CHECKLIST’e uygun olarak **tüm ilgili secret’ların rotate edilmesi** gerekir.

**Öneriler:** Secret’ları ortam değişkeni veya vault (HashiCorp Vault, AWS Secrets Manager) ile yönetin; `.env.production` yalnızca yerel kopya olarak kullanılıyorsa repoda olmadığından emin olun (git history kontrolü).

---

## 4. Altyapı ve Ağ Güvenliği

### Güçlü Yönler
- **TLS:** Nginx `ssl-params.conf` ile TLS 1.2/1.3, güçlü cipher listesi, OCSP stapling.
- **HSTS:** `Strict-Transport-Security` max-age=2 yıl, includeSubDomains.
- **Diğer header’lar:** X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy (nginx + FastAPI SecurityHeadersMiddleware).
- **Ağ segmentasyonu:** docker-compose’da `frontend` / `backend` ağları; API, Postgres, Redis backend’de.
- **HTTPS yönlendirme:** Subdomain’ler HTTPS’e 301 ile yönlendiriliyor; ACME challenge için 80 açık.

### Zayıf Yönler / Riskler
- **WAF yok:** OWASP ModSecurity veya bulut WAF tanımlı değil.
- **Rate limiting:** Nginx veya uygulama seviyesinde limit yok.
- **API timeout:** Nginx `proxy_read_timeout 300s` uzun; gerekirse kritik endpoint’ler için düşürülebilir.

**Öneriler:** Nginx limit_req_zone ile rate limit; isteğe bağlı WAF; DDoS koruması (cloud veya rate limit).

---

## 5. Güvenli Yapılandırma

### Güçlü Yönler
- **CORS:** `CORS_ORIGINS` ortam değişkeni ile sınırlı origin listesi; `allow_credentials=True` ile cookie kullanımına uyumlu tanım mümkün.
- **Docs:** `/api/docs`, `/api/openapi.json` varsayılan; production’da kapatılabilir (şu an açık).
- **CSV import:** Manuel CSV yükleme devre dışı; veri BIST otomasyonu (Celery) ile alınıyor; dosya yükleme yüzeyi yok.

### Zayıf Yönler / Riskler
- **CSP yok:** Content-Security-Policy header’ı yok; XSS azaltma için CSP eklenebilir.
- **Permissions-Policy:** Cihaz API’leri (kamera, mikrofon vb.) için kısıtlama tanımlı değil.

**Öneriler:** Nonce veya hash tabanlı CSP; Permissions-Policy eklenmesi.

---

## 6. Loglama ve Olay Müdahalesi

### Mevcut Durum
- Python `logging` kullanılıyor; migration, admin seed, hesaplama hataları loglanıyor.
- Hassas veri (parola, token) loglara yazılmıyor.
- Nginx access/error log formatı standart.

### Eksikler
- **Yapılandırılmış log:** JSON format, trace ID yok.
- **SIEM/alerting:** Merkezi toplama, güvenlik olayı korelasyonu ve uyarı playbook’ları yok.
- **Audit log:** Kimin, ne zaman, hangi admin işlemini yaptığına dair audit trail yok.

**Öneriler:** Yapılandırılmış (örn. JSON) log; kritik hata ve başarısız login için alerting; admin işlemleri için audit log.

---

## 7. Bağımlılık ve Tedarik Zinciri

### Mevcut Durum
- `requirements.txt` sabit sürüm içermiyor; `fastapi[standard]`, `sqlalchemy[asyncio]` vb. en güncel sürüme çekiliyor.
- Bilinen CVE taraması (Snyk, Trivy, pip-audit) veya SBOM üretimi raporlanmıyor.

### Risk
- Bağımlılık güncellemesi breaking change veya yeni CVE getirebilir; sabit sürüm + periyodik güncelleme stratejisi yok.

**Öneriler:** `pip freeze` veya `pip-tools` ile sabit sürümler; CI’da `pip-audit` veya `safety`; SBOM (örn. CycloneDX) üretimi; düzenli güncelleme penceresi.

---

## 8. Uyumluluk ve Dokümantasyon

### Güçlü Yönler
- **PRODUCTION_CHECKLIST.md:** Secret’lar, ilk kurulum, deploy script ve opsiyonel güvenlik adımları açık.
- **Deploy script:** Domain, secret placeholder ve ENVIRONMENT kontrolleri var.
- **Güvenlik notları:** JWT depolama ve rate limit dokümante edilmiş.

### Eksikler
- Resmi güvenlik politikası veya sorumluluk açıklaması (ör. vulnerability disclosure) yok.
- OWASP ASVS veya CIS benchmark’a açık eşleme yok.

---

## OWASP Top 10 Kısa Eşleme

| OWASP 2021 | Durum | Not |
|------------|--------|-----|
| A01 Broken Access Control | Kısmen | RBAC/admin guard var; token iptali ve MFA yok |
| A02 Cryptographic Failures | İyi | TLS 1.2/1.3, bcrypt, hassas veri log’da yok |
| A03 Injection | İyi | ORM, parametreli sorgular, Pydantic |
| A04 Insecure Design | Orta | Rate limit, MFA, CSP tasarımda yok |
| A05 Security Misconfiguration | Orta | CORS/header iyi; CSP, rate limit eksik |
| A06 Vulnerable Components | Orta | Bağımlılık taraması ve SBOM yok |
| A07 Auth/Session Failures | Orta | JWT + bcrypt iyi; localStorage, MFA, iptal eksik |
| A08 Software/Data Integrity | Orta | SBOM ve imza doğrulama yok |
| A09 Logging/Monitoring | Zayıf | Temel loglama; SIEM/alerting yok |
| A10 SSRF | Düşük risk | Harici URL’ler sabit (BIST); kullanıcı URL’i yok |

---

## Başarı Kriterleri (Skill’e Göre) – Durum

| Kriter | Durum |
|--------|--------|
| Tüm kritik (CVSS 7+) açıklar giderildi | N/A (formal tarama yapılmadı; kod incelemesinde kritik enjeksiyon yok) |
| OWASP Top 10 ele alındı | Kısmen (yukarıdaki tablo) |
| Pentest’te yüksek risk yok | Doğrulanmadı (pentest yapılmadı) |
| Uyumluluk çerçeveleri doğrulandı | Kısmen (checklist ve dokümantasyon) |
| Güvenlik izleme ve alarm | Eksik (SIEM/playbook yok) |
| SBOM üretildi / takip | Hayır |
| Secret’lar güvenli vault’ta | Hayır (env dosyası; .env.production repoda olmamalı) |
| MFA ve güvenli oturum | Kısmen (oturum süresi iyi; MFA yok) |
| Güvenlik testleri CI/CD’de | Hayır |

---

## Öncelikli İyileştirme Planı

1. **Hemen:** `.env.production` dosyasının repoda/git geçmişinde olmadığını doğrulayın; varsa tüm production secret’ları rotate edin.
2. **Kısa vade:** Login/signup ve mümkünse `/api/v1/auth` için rate limiting (Nginx veya FastAPI); JWT’yi httpOnly cookie + opsiyonel refresh token’a taşıyın.
3. **Orta vade:** CSP header; bağımlılık sabit sürüm + `pip-audit` (veya eşdeğeri) CI’da; SBOM üretimi.
4. **Uzun vade:** MFA (TOTP/WebAuthn); audit log (admin işlemleri); SIEM/alerting ve basit incident playbook’ları.

Bu belge, paylaştığınız security hardening skill’indeki fazlara (assessment, remediation, controls, validation) göre FinCalc’ın mevcut durumunu özetler. İsterseniz bir sonraki adımda belirli bir madde için patch önerisi veya konfigürasyon örneği çıkarabilirim.
