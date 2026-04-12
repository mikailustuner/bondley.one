# CI/CD ve Canary Deployment Kurulum Rehberi

Bu dokümantasyon, FinCalc projesi için GitHub Actions tabanlı CI/CD pipeline ve canary deployment sisteminin kurulumunu açıklar.

## Genel Bakış

Sistem şu özelliklere sahiptir:
- **Otomatik Test**: Her push'ta lint, build ve test adımları çalışır
- **Canary Deployment**: Başarılı testlerden sonra canary ortamına otomatik deploy
- **Trafik Dağılımı**: %10 trafik canary'e, %90 trafik stable'e yönlendirilir
- **Otomatik Promote**: Canary başarılı olursa otomatik olarak stable'e promote edilir
- **Rollback**: Sorun durumunda otomatik rollback

## Gereksinimler

1. GitHub repository
2. Production sunucu (SSH erişimi)
3. Docker ve Docker Compose kurulu sunucuda
4. Git kurulu sunucuda

## Kurulum Adımları

### 1. GitHub Secrets Yapılandırması

GitHub repository'nizde Settings > Secrets and variables > Actions bölümünden şu secret'ları ekleyin:

- `DEPLOY_SSH_KEY`: Sunucuya SSH erişimi için private key
- `DEPLOY_HOST`: Sunucu IP adresi veya domain
- `DEPLOY_USER`: SSH kullanıcı adı
- `DEPLOY_PATH`: Proje dizini yolu (örn: `/home/user/fincalc`)

#### SSH Key Oluşturma

```bash
# Sunucuda SSH key oluştur
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

# Public key'i authorized_keys'e ekle
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Private key'i kopyala (GitHub Secrets'a eklenecek)
cat ~/.ssh/github_actions
```

### 2. Sunucu Hazırlığı

Sunucuda şu komutları çalıştırın:

```bash
# Proje dizinine git
cd $DEPLOY_PATH

# Scriptleri executable yap
chmod +x scripts/*.sh

# İlk deployment için stable ortamı başlat
docker-compose -f docker-compose.prod.yml up -d
```

### 3. İlk Deployment

İlk deployment için manuel olarak şu adımları izleyin:

```bash
# Sunucuda
cd $DEPLOY_PATH
git pull origin main

# Stable ortamı başlat
docker-compose -f docker-compose.prod.yml up -d

# Health check
./scripts/health-check.sh stable
```

## Workflow Açıklaması

### Test Stage

Her push ve PR'da çalışır:
1. Kod checkout
2. Node.js ve Python kurulumu
3. Dependency kurulumu
4. Lint kontrolü
5. Build kontrolü
6. Docker image build testi

### Deploy Canary Stage

Sadece `main` veya `master` branch'ine push'ta çalışır:
1. SSH ile sunucuya bağlanma
2. Kod güncelleme (git pull)
3. Canary container'ları build etme
4. Canary container'ları başlatma
5. Health check
6. Smoke test
7. Nginx yapılandırmasını güncelleme (%10 canary trafiği)

### Monitoring Stage

Canary deployment'tan sonra:
1. 5 dakika bekleme
2. Canary container'ların sağlık durumunu kontrol etme
3. Başarılı ise promote, başarısız ise rollback

### Promote Stage

Canary başarılı olduğunda:
1. Stable container'ları durdurma
2. Stable container'ları güncelleme
3. Stable container'ları başlatma
4. Nginx'i %100 stable'e yönlendirme
5. Canary container'ları kaldırma

## Manuel İşlemler

### Canary'i Manuel Promote Etme

GitHub Actions'da "Run workflow" butonuna tıklayıp `promote_canary: true` seçeneğini işaretleyin.

Veya sunucuda:
```bash
cd $DEPLOY_PATH
./scripts/promote-canary.sh
```

### Canary'i Manuel Rollback Etme

GitHub Actions'da "Run workflow" butonuna tıklayıp `rollback: true` seçeneğini işaretleyin.

Veya sunucuda:
```bash
cd $DEPLOY_PATH
./scripts/rollback.sh
```

### Health Check Çalıştırma

```bash
# Stable için
./scripts/health-check.sh stable

# Canary için
./scripts/health-check.sh canary
```

### Smoke Test Çalıştırma

```bash
# Stable için
./scripts/test-smoke.sh stable

# Canary için
./scripts/test-smoke.sh canary
```

## Nginx Canary Routing

Canary deployment sırasında Nginx otomatik olarak şu şekilde yapılandırılır:

```nginx
upstream web_backend {
    server web:3000 weight=90;      # Stable: %90
    server web-canary:3000 weight=10; # Canary: %10
}

upstream api_backend {
    server api:8000 weight=90;      # Stable: %90
    server api-canary:8000 weight=10; # Canary: %10
}
```

## Sorun Giderme

### Canary Container'lar Başlamıyor

```bash
# Logları kontrol et
docker-compose -f docker-compose.canary.yml logs

# Container'ları yeniden başlat
docker-compose -f docker-compose.canary.yml down
docker-compose -f docker-compose.canary.yml up -d
```

### Nginx Yapılandırma Hatası

```bash
# Nginx config test
docker exec fincalc-nginx nginx -t

# Canary config'i kaldır
docker exec fincalc-nginx rm -f /etc/nginx/conf.d/canary.conf
docker exec fincalc-nginx nginx -s reload
```

### Health Check Başarısız

```bash
# API health endpoint'i kontrol et
curl http://localhost:8000/health  # Stable
curl http://localhost:8001/health  # Canary

# Container durumunu kontrol et
docker ps --filter "name=fincalc"
```

## Güvenlik Notları

1. **SSH Key**: GitHub Secrets'da saklanan SSH private key'i güvenli tutun
2. **Environment Variables**: `.env` dosyasını asla commit etmeyin
3. **Secrets Rotation**: Düzenli olarak SSH key ve JWT secret'ları rotate edin
4. **Access Control**: Sunucuya erişimi sınırlandırın (firewall, SSH key-only)

## Monitoring ve Alerting

Canary deployment sırasında şu metrikleri izleyin:
- Error rate
- Response time
- Container health
- Database connection pool
- Redis connection

## İleri Seviye Özellikler

### Custom Canary Traffic Percentage

`nginx/conf.d/canary.conf.template` dosyasındaki weight değerlerini değiştirerek trafik dağılımını ayarlayabilirsiniz.

### Monitoring Period

`.github/workflows/deploy.yml` dosyasındaki `sleep 300` değerini değiştirerek monitoring süresini ayarlayabilirsiniz.

### Multiple Canary Environments

İhtiyaç duyulursa, farklı canary ortamları oluşturulabilir (örn: `canary-1`, `canary-2`).
