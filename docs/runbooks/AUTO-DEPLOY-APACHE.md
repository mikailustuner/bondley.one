# Main Auto-Deploy ve Apache Kurulumu

## Mimari

```text
GitHub main push
  → GitHub Actions
  → SSH
  → sunucudaki repository
  → fast-forward ile tam push commit'i
  → deploy.sh

İnternet :80/:443
  → host Apache2 + Let's Encrypt
  → 127.0.0.1:3050
  → Docker Nginx
  → API / Next.js
```

Docker gateway yalnız `127.0.0.1:3050` üzerinde yayınlanır. Uygulama portu
internete doğrudan açılmaz.

## 1. Sunucuyu bir kez hazırlama

Repository konumu workflow ile uyumlu olarak
`/home/admin/bondley.one` olmalıdır. SSH deploy kullanıcısı:

- repository üzerinde yazma hakkına,
- private repository için salt-okunur Git deploy key'e,
- Docker çalıştırma yetkisine sahip olmalıdır.

Repository main branch üzerinde ve temiz olmalıdır:

```bash
cd /home/admin/bondley.one
git switch main
git pull --ff-only origin main
chmod +x deploy.sh scripts/*.sh
cp .env.example .env
./scripts/generate_secrets.sh
# .env içindeki domain, secret, SMTP ve admin değerlerini tamamlayın.
./deploy.sh
```

İlk manuel `git pull`, `scripts/server-deploy.sh` dosyasının sunucuda bulunması
için zorunludur. Daha sonraki güncellemeler GitHub Actions tarafından yapılır.

## 2. Apache modülleri ve sertifika

Gerekli modüller:

```bash
sudo a2enmod proxy proxy_http proxy_wstunnel headers rewrite ssl
```

Mevcut ve şu adları kapsayan bir Let's Encrypt sertifikası varsa doğrudan
3. adıma geçin:

- `bondley.one`
- `www.bondley.one`
- `api.bondley.one`
- `dashboard.bondley.one`
- `admin.bondley.one`

İlk sertifika henüz yoksa önce DNS kayıtlarının bu sunucuyu gösterdiğini
doğrulayın, ardından geçici HTTP vhost ile sertifikayı alın:

```bash
sudo install -m 0644 \
  /home/admin/bondley.one/ops/apache/bondley-http-bootstrap.conf \
  /etc/apache2/sites-available/bondley-http-bootstrap.conf
sudo a2ensite bondley-http-bootstrap.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
sudo certbot certonly --apache \
  -d bondley.one \
  -d www.bondley.one \
  -d api.bondley.one \
  -d dashboard.bondley.one \
  -d admin.bondley.one
```

DNS kaydı bulunmayan bir alt alan adını Certbot komutuna eklemeyin; aynı alt
alan adını `ops/apache/bondley.conf` içindeki `ServerAlias` listesinden de
çıkarın.

## 3. Production Apache vhost'u

```bash
cd /home/admin/bondley.one
sudo ./scripts/install-apache-proxy.sh
sudo apache2ctl -S
curl -fsS http://127.0.0.1:3050/nginx-health
curl -fsS https://bondley.one/health/live
curl -fsS https://bondley.one/health/ready
```

Script sertifika dosyasını kontrol eder, gerekli modülleri açar,
`ops/apache/bondley.conf` dosyasını kurar, `apache2ctl configtest` başarılı
olmadan Apache'yi reload etmez.

Sunucuda aynı `ServerName` veya `ServerAlias` değerlerini kullanan eski bir
vhost varsa `apache2ctl -S` çıktısından bulunup kontrollü biçimde devre dışı
bırakılmalıdır.

## 4. GitHub production ayarları

Repository → **Settings → Environments** altında `production` environment'ı
oluşturun. Aşağıdaki environment secret'larını ekleyin:

| Ad | Değer |
| --- | --- |
| `DEPLOY_HOST` | Sunucu SSH hostname/IP |
| `DEPLOY_USER` | `admin` |
| `DEPLOY_SSH_KEY` | Yalnız deploy için oluşturulan private Ed25519 anahtar |

İsteğe bağlı environment variable:

| Ad | Örnek |
| --- | --- |
| `DEPLOY_PORT` | `22` |

Deploy yolu workflow içinde `/home/admin/bondley.one` olarak sabittir.

Workflow `StrictHostKeyChecking=accept-new` kullanır; GitHub runner sunucu
anahtarını ilk bağlantıda otomatik kabul eder.

## 5. Deploy davranışı

Her `main` push'unda `.github/workflows/deploy-production.yml`:

1. Zorunlu SSH ayarlarını kontrol eder.
2. Sunucuya SSH ile bağlanır.
3. Push edilen 40 karakterlik commit SHA'sını sunucu scriptine verir.
4. Sunucudaki çalışma ağacı kirliyse durur.
5. Çalışan PostgreSQL varsa doğrulanmış sıkıştırılmış yedek alır.
6. Yalnız fast-forward güncellemeye izin verir.
7. Aynı anda ikinci deploy'u `flock` ile engeller.
8. Migration, ilk-açılış bootstrap ve readiness kontrollerini `deploy.sh`
   üzerinden tamamlar.

Daha yeni bir main push'u geldiyse eski sıradaki deploy çalışmadan başarılı
biçimde atlanır. Script `git reset --hard`, volume silme veya migration
downgrade işlemi yapmaz.

Slack bildirimi ve changelog workflow'u yoktur.
