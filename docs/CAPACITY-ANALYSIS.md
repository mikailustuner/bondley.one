# Sistem Kapasite Analizi

## Sunucu Özellikleri
- **RAM:** 8 GB
- **vCPU:** 2 core
- **Mimari:** Docker container'ları ile mikroservis yapısı

## Sistem Bileşenleri ve Kaynak Kullanımı

### 1. Servisler ve Tahmini RAM Kullanımı

| Servis | RAM (Idle) | RAM (Yük Altında) | Notlar |
|--------|------------|-------------------|--------|
| **PostgreSQL** | 500 MB | 1.5 GB | Veritabanı, index'ler, cache |
| **Redis** | 100 MB | 300 MB | Cache ve task queue |
| **FastAPI (Uvicorn)** | 200 MB | 600 MB | API servisi (1 worker) |
| **Next.js (Frontend)** | 200 MB | 400 MB | SSR ve static serving |
| **Nginx** | 50 MB | 100 MB | Reverse proxy |
| **Celery Worker** | 100 MB | 200 MB | Background tasks (2 concurrency) |
| **Celery Beat** | 50 MB | 100 MB | Scheduled tasks |
| **Sistem Overhead** | 500 MB | 800 MB | OS, Docker, diğer |
| **TOPLAM** | **~1.7 GB** | **~4.0 GB** | Normal kullanımda |

### 2. Veritabanı Bağlantı Havuzu

```python
pool_size=20        # Normal bağlantı sayısı
max_overflow=10     # Ekstra bağlantı (toplam 30)
```

**Maksimum eşzamanlı veritabanı bağlantısı:** 30

### 3. CPU Kullanımı

- **2 vCPU** ile sınırlı
- FastAPI async yapısı sayesinde I/O-bound işlemlerde verimli
- CPU-intensive işlemler (hesaplamalar) için Celery worker kullanılıyor

## Kullanıcı Kapasitesi Tahmini

### Senaryo 1: Normal Kullanım (Önerilen)
- **Eşzamanlı aktif kullanıcı:** 50-80 kullanıcı
- **Toplam kayıtlı kullanıcı:** 500-1,000 kullanıcı
- **Peak eşzamanlı request:** 20-30 request/saniye
- **RAM kullanımı:** ~3-4 GB
- **CPU kullanımı:** %40-60

**Özellikler:**
- Tahvil listesi görüntüleme
- Tahvil detay sayfası
- Hesaplama yapma
- Admin paneli kullanımı

### Senaryo 2: Yoğun Kullanım (Maksimum)
- **Eşzamanlı aktif kullanıcı:** 100-150 kullanıcı
- **Toplam kayıtlı kullanıcı:** 1,000-2,000 kullanıcı
- **Peak eşzamanlı request:** 40-50 request/saniye
- **RAM kullanımı:** ~5-6 GB
- **CPU kullanımı:** %70-90

**Riskler:**
- RAM tükenmesi riski
- Veritabanı bağlantı havuzu dolabilir
- Response time artabilir (1-3 saniye)

### Senaryo 3: Aşırı Yük (Önerilmez)
- **Eşzamanlı aktif kullanıcı:** 200+ kullanıcı
- **RAM kullanımı:** 7+ GB
- **Sonuç:** OOM (Out of Memory) hataları, servis kesintileri

## Performans Optimizasyon Önerileri

### 1. RAM Optimizasyonu
```yaml
# docker-compose.prod.yml içinde memory limitleri ekleyin:
services:
  postgres:
    mem_limit: 2g
    memswap_limit: 2g
  api:
    mem_limit: 1g
  web:
    mem_limit: 512m
```

### 2. Veritabanı Optimizasyonu
- PostgreSQL `shared_buffers` ayarı: RAM'in %25'i (2 GB)
- `effective_cache_size`: RAM'in %75'i (6 GB)
- Index'lerin düzenli bakımı (`VACUUM`, `ANALYZE`)

### 3. Caching Stratejisi
- Redis cache kullanımını artırın
- API response caching (TTL: 5-15 dakika)
- Frontend static asset caching

### 4. Uvicorn Worker Ayarları
```python
# Şu anki varsayılan: 1 worker
# Önerilen: CPU sayısı kadar worker (2 worker)
# Uvicorn command: uvicorn app.main:app --workers 2 --host 0.0.0.0 --port 8000
```

### 5. Celery Worker Optimizasyonu
```yaml
# Şu anki: --concurrency=2
# Yoğun kullanım için: --concurrency=4 (CPU sayısının 2 katı)
```

## Ölçeklendirme Senaryoları

### Dikey Ölçeklendirme (Vertical Scaling)
**16 GB RAM, 4 vCPU'ya çıkarsa:**
- **Eşzamanlı aktif kullanıcı:** 200-300 kullanıcı
- **Toplam kayıtlı kullanıcı:** 2,000-5,000 kullanıcı
- **Peak request:** 80-100 request/saniye

### Yatay Ölçeklendirme (Horizontal Scaling)
**Load balancer + 2 sunucu (her biri 8 GB RAM, 2 vCPU):**
- **Eşzamanlı aktif kullanıcı:** 150-200 kullanıcı
- **Toplam kayıtlı kullanıcı:** 2,000-3,000 kullanıcı
- **Yük dağılımı:** Nginx load balancer ile

## Monitoring ve Alerting Önerileri

### Kritik Metrikler
1. **RAM kullanımı:** %80 üzerinde uyarı
2. **CPU kullanımı:** %90 üzerinde uyarı
3. **Veritabanı bağlantı sayısı:** 25+ uyarı
4. **Response time:** 2 saniye üzerinde uyarı
5. **Error rate:** %1 üzerinde uyarı

### Önerilen Araçlar
- **Prometheus + Grafana:** Metrik toplama ve görselleştirme
- **ELK Stack:** Log analizi
- **Uptime monitoring:** Pingdom, UptimeRobot

## Sonuç ve Öneriler

### Mevcut Konfigürasyon (8 GB RAM, 2 vCPU)
✅ **Önerilen kullanım:** 50-80 eşzamanlı aktif kullanıcı  
✅ **Toplam kayıtlı kullanıcı:** 500-1,000 kullanıcı  
⚠️ **Maksimum:** 100-150 eşzamanlı aktif kullanıcı (performans düşüşü olabilir)

### Hızlı İyileştirmeler
1. ✅ Redis caching'i aktif kullanın
2. ✅ Database query'leri optimize edin
3. ✅ Static asset'leri CDN'e taşıyın
4. ✅ Gzip compression aktif olsun
5. ✅ Database connection pool'u izleyin

### Uzun Vadeli Planlama
- **500+ aktif kullanıcı için:** 16 GB RAM, 4 vCPU
- **1,000+ aktif kullanıcı için:** Load balancer + multiple instances
- **5,000+ aktif kullanıcı için:** Kubernetes cluster

## Test Senaryoları

### Load Testing
```bash
# Apache Bench ile test
ab -n 1000 -c 50 https://yourdomain.com/api/v1/bonds

# Locust ile daha detaylı test
locust -f locustfile.py --users 100 --spawn-rate 10
```

### Stress Testing
- Kademeli olarak kullanıcı sayısını artırın
- RAM ve CPU kullanımını izleyin
- Response time'ı ölçün
- Error rate'i takip edin

---

**Not:** Bu tahminler genel kullanım senaryolarına göre yapılmıştır. Gerçek performans, veri hacmi, kullanıcı davranışları ve network koşullarına göre değişebilir. Production'da mutlaka load testing yapılmalıdır.
