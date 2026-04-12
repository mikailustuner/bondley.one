# FinCalc Production Checklist

Canli ortama gecmeden once asagidaki maddeleri tamamlayin.

## Ortam ve Secret'lar

- [ ] **ENVIRONMENT** – `.env` icinde `ENVIRONMENT=production` tanimli olsun. API startup'ta zayif default secret'lar reddedilir.
- [ ] **JWT_SECRET_KEY** – En az 32 karakter, guclu rastgele string. Default deger production'da kabul edilmez.
- [ ] **POSTGRES_PASSWORD** – Varsayilan `fincalc_secret` kullanilmayacak; guclu sifre secin.
- [ ] **ADMIN_INIT_PASSWORD** – Ilk admin kullanici olusturulurken kullanilir. Bos birakilirsa production'da admin olusturulmaz; mutlaka set edin.
- [ ] **.env.production** – Bu dosyayi asla git'e commit etmeyin. `.gitignore`'da olsa bile repoda bir kez commit edildiyse tum secret'lari degistirin (rotate).

## Ilk Kurulum Sonrasi

- [ ] **Admin sifresi** – Ilk giris sonrasi admin sifresini hemen degistirin. `database/init.sql` veya ilk seed ile gelen sabit hash biliniyorsa guvenlik riski olusur.
- [ ] **Secret rotation** – Eger .env veya secret'lar herhangi bir yerde (log, repo, ekran) gorunduyse JWT ve DB sifrelerini yenileyin.

## Deploy Script

- [ ] `deploy.sh` calistirildiginda log'larda gerçek admin sifresi yazilmaz; sadece .env kullanilması hatirlatilir.
- [ ] DNS ve SSL adimlarini tamamlayin; deploy sonrasi `ENVIRONMENT=production` ile API'nin acildigini dogrulayin.

## Opsiyonel Guvenlik

- **Rate limiting** – Login ve signup endpoint'leri icin (nginx veya FastAPI middleware ile) brute-force azaltmak amaciyla rate limit eklenmesi onerilir.
- **JWT depolama** – Web uygulamasi token'i localStorage'da tutar; XSS'te risk olabilir. Ileride refresh token ve httpOnly cookie degerlendirilebilir.
