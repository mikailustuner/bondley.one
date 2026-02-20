# Celery Beat ve Worker Sorun Giderme Rehberi

## Hızlı Teşhis

### 1. Container Durumunu Kontrol Et

```bash
# Tüm Celery container'larının durumunu görüntüle
docker ps --filter "name=celery" --format "table {{.Names}}\t{{.Status}}\t{{.Health}}"

# Veya tüm servisleri kontrol et
docker-compose -f docker-compose.prod.yml ps
```

### 2. Logları İncele

```bash
# Celery Worker logları (son 100 satır)
docker logs --tail 100 fincalc-celery-worker

# Celery Beat logları (son 100 satır)
docker logs --tail 100 fincalc-celery-beat

# Canlı log takibi
docker logs -f fincalc-celery-worker
docker logs -f fincalc-celery-beat
```

### 3. Diagnostic Script Çalıştır

```bash
chmod +x scripts/diagnose-celery.sh
./scripts/diagnose-celery.sh
```

Bu script şunları kontrol eder:
- Container durumu
- Son loglar ve hatalar
- Redis bağlantısı
- PostgreSQL bağlantısı
- Celery app import durumu
- Worker ve beat process durumu

## Yaygın Sorunlar ve Çözümleri

### Sorun 1: Container Unhealthy Durumda

**Neden:** Healthcheck tanımlı değil veya başarısız oluyor.

**Çözüm:**
```bash
# Healthcheck'leri kontrol et
docker inspect fincalc-celery-worker | grep -A 10 Healthcheck
docker inspect fincalc-celery-beat | grep -A 10 Healthcheck

# Container'ı yeniden başlat
docker-compose -f docker-compose.prod.yml restart celery-worker celery-beat
```

### Sorun 2: Redis Bağlantı Hatası

**Belirtiler:**
- Loglarda `ConnectionError`, `redis.exceptions.ConnectionError`
- `Error connecting to Redis`

**Çözüm:**
```bash
# Redis container'ının çalıştığını kontrol et
docker ps | grep redis

# Redis'e bağlanmayı test et
docker exec fincalc-celery-worker python -c "
import os
import redis
r = redis.from_url(os.environ.get('REDIS_URL'))
r.ping()
print('Redis OK')
"

# Redis'i yeniden başlat
docker-compose -f docker-compose.prod.yml restart redis
```

### Sorun 3: PostgreSQL Bağlantı Hatası

**Belirtiler:**
- Loglarda `psycopg2.OperationalError`, `connection refused`
- `Error connecting to PostgreSQL`

**Çözüm:**
```bash
# PostgreSQL container'ının çalıştığını kontrol et
docker ps | grep postgres

# PostgreSQL'e bağlanmayı test et
docker exec fincalc-celery-worker python -c "
import sys
sys.path.insert(0, '/app')
from app.database import get_db
from sqlalchemy import text
db = next(get_db())
db.execute(text('SELECT 1'))
print('PostgreSQL OK')
"

# PostgreSQL'i yeniden başlat
docker-compose -f docker-compose.prod.yml restart postgres
```

### Sorun 4: Celery App Import Hatası

**Belirtiler:**
- Loglarda `ImportError`, `ModuleNotFoundError`
- `Failed to import celery app`

**Çözüm:**
```bash
# Celery app'i manuel import et
docker exec fincalc-celery-worker python -c "
import sys
sys.path.insert(0, '/app')
from app.tasks.celery_app import celery_app
print('Import OK')
print(f'Broker: {celery_app.conf.broker_url}')
"

# Container'ı yeniden build et
docker-compose -f docker-compose.prod.yml build celery-worker celery-beat
docker-compose -f docker-compose.prod.yml up -d celery-worker celery-beat
```

### Sorun 5: Beat Schedule Dosyası Hatası

**Belirtiler:**
- Beat loglarında `Permission denied`, `Cannot write to schedule file`
- `/tmp/celerybeat-schedule` dosyası yazılamıyor

**Çözüm:**
```bash
# Schedule dosyası izinlerini kontrol et
docker exec fincalc-celery-beat ls -la /tmp/celerybeat*

# Schedule dosyasını sil ve yeniden başlat
docker exec fincalc-celery-beat rm -f /tmp/celerybeat.pid /tmp/celerybeat-schedule
docker-compose -f docker-compose.prod.yml restart celery-beat
```

### Sorun 6: Worker Process Çöküyor

**Belirtiler:**
- Container sürekli restart oluyor
- Loglarda `Killed`, `Segmentation fault`

**Çözüm:**
```bash
# Memory kullanımını kontrol et
docker stats fincalc-celery-worker fincalc-celery-beat

# Concurrency'yi azalt
# docker-compose.prod.yml'de: --concurrency=1

# Container'ı yeniden build ve başlat
docker-compose -f docker-compose.prod.yml down celery-worker celery-beat
docker-compose -f docker-compose.prod.yml build celery-worker celery-beat
docker-compose -f docker-compose.prod.yml up -d celery-worker celery-beat
```

## Manuel Test Komutları

### Celery Worker Testi

```bash
# Worker'ın aktif olduğunu kontrol et
docker exec fincalc-celery-worker celery -A app.tasks.celery_app inspect ping

# Worker stats
docker exec fincalc-celery-worker celery -A app.tasks.celery_app inspect stats

# Aktif task'ları görüntüle
docker exec fincalc-celery-worker celery -A app.tasks.celery_app inspect active

# Kayıtlı task'ları görüntüle
docker exec fincalc-celery-worker celery -A app.tasks.celery_app inspect registered
```

### Celery Beat Testi

```bash
# Beat schedule'ı kontrol et
docker exec fincalc-celery-beat celery -A app.tasks.celery_app inspect scheduled

# Beat'in çalıştığını kontrol et
docker exec fincalc-celery-beat ps aux | grep celery
```

### Test Task Çalıştırma

```bash
# Basit bir test task'ı çalıştır
docker exec fincalc-celery-worker python -c "
import sys
sys.path.insert(0, '/app')
from app.tasks.celery_app import celery_app
result = celery_app.send_task('app.tasks.data_tasks.fetch_daily_tlref')
print(f'Task ID: {result.id}')
"
```

## Yeniden Başlatma İşlemleri

### Yumuşak Yeniden Başlatma

```bash
# Container'ları restart et (kod değişikliği yoksa)
docker-compose -f docker-compose.prod.yml restart celery-worker celery-beat
```

### Tam Yeniden Başlatma

```bash
# Container'ları durdur ve kaldır
docker-compose -f docker-compose.prod.yml stop celery-worker celery-beat
docker-compose -f docker-compose.prod.yml rm -f celery-worker celery-beat

# Yeniden build ve başlat
docker-compose -f docker-compose.prod.yml build celery-worker celery-beat
docker-compose -f docker-compose.prod.yml up -d celery-worker celery-beat
```

### Tam Temizlik ve Yeniden Başlatma

```bash
# Tüm Celery container'larını kaldır
docker-compose -f docker-compose.prod.yml down celery-worker celery-beat

# Image'ları yeniden build et
docker-compose -f docker-compose.prod.yml build --no-cache celery-worker celery-beat

# Yeniden başlat
docker-compose -f docker-compose.prod.yml up -d celery-worker celery-beat

# Logları takip et
docker-compose -f docker-compose.prod.yml logs -f celery-worker celery-beat
```

## Healthcheck Kontrolü

Healthcheck'ler şu şekilde çalışır:

**Celery Worker:**
```bash
celery -A app.tasks.celery_app inspect ping
```

**Celery Beat:**
```bash
test -f /tmp/celerybeat.pid && ps -p $(cat /tmp/celerybeat.pid) > /dev/null
```

Healthcheck durumunu kontrol etmek için:
```bash
docker inspect fincalc-celery-worker --format='{{json .State.Health}}' | jq
docker inspect fincalc-celery-beat --format='{{json .State.Health}}' | jq
```

## Log Analizi

### Hata Desenleri

```bash
# Tüm ERROR loglarını bul
docker logs fincalc-celery-worker 2>&1 | grep -i error
docker logs fincalc-celery-beat 2>&1 | grep -i error

# Exception'ları bul
docker logs fincalc-celery-worker 2>&1 | grep -i exception
docker logs fincalc-celery-beat 2>&1 | grep -i exception

# Traceback'leri bul
docker logs fincalc-celery-worker 2>&1 | grep -A 20 traceback
docker logs fincalc-celery-beat 2>&1 | grep -A 20 traceback
```

### Log Dosyasına Kaydet

```bash
# Logları dosyaya kaydet
docker logs fincalc-celery-worker > celery-worker.log 2>&1
docker logs fincalc-celery-beat > celery-beat.log 2>&1
```

## İletişim ve Destek

Sorun devam ederse:
1. `scripts/diagnose-celery.sh` scriptini çalıştırın
2. Logları kaydedin
3. Environment variable'ları kontrol edin
4. Container resource kullanımını kontrol edin (`docker stats`)
