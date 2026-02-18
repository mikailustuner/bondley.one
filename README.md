# FinCalc - Turk Devlet Tahvil Analiz Platformu

Turk Devlet Tahvilleri (TRT/TRB) icin degerleme, fiyat takibi ve analiz sistemi.

## Teknoloji Yigini

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/UI, Recharts
- **Backend:** Python FastAPI, SQLAlchemy (async), numpy-financial
- **Veritabani:** PostgreSQL (tum parasal degerler DECIMAL)
- **Kuyruk:** Celery + Redis
- **Altyapi:** Docker Compose, Turborepo

## Hizli Baslangic

### Docker ile (Onerilen)

```bash
# Tum servisleri baslat
docker-compose up -d

# DB schema'yi olustur (otomatik init.sql ile)
# API: http://localhost:8000/api/docs
# Web: http://localhost:3000
```

### Manuel Gelistirme

```bash
# 1. PostgreSQL ve Redis baslat
docker-compose up -d postgres redis

# 2. Python backend
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Celery worker
celery -A app.tasks.celery_app worker --loglevel=info

# 4. Celery beat (zamanlanmis gorevler)
celery -A app.tasks.celery_app beat --loglevel=info

# 5. Next.js frontend
cd apps/web
npm install
npm run dev
```

## Subdomain Yonlendirmesi

| Subdomain | Aciklama |
|---|---|
| landing.domain.com | Urun tanitim sayfasi |
| dashboard.domain.com | Tahvil verileri, grafikler |
| admin.domain.com | Veri girisi, kullanici yonetimi |

Lokal gelistirme icin `/etc/hosts` dosyasina ekleyin:
```
127.0.0.1 landing.localhost dashboard.localhost admin.localhost
```

## API Endpointleri

- `POST /api/v1/auth/login` - Giris
- `GET /api/v1/bonds/` - Tahvil listesi
- `GET /api/v1/bonds/{isin}` - Tahvil detay
- `GET /api/v1/market-data/{isin}` - Piyasa verileri
- `POST /api/v1/calculations/run` - Hesaplama calistir
- `POST /api/v1/import/csv` - CSV dosyasi yukle
- `GET /api/v1/tlref/latest` - Son TLREF orani
- `POST /api/v1/tlref/fetch-daily` - BIST'ten TLREF cek

## Varsayilan Giris

- Email: `admin@fincalc.com`
- Sifre: `admin123`

## Proje Yapisi

```
FinCalc/
├── apps/
│   ├── web/          # Next.js 14 Frontend
│   └── api/          # Python FastAPI Backend
├── packages/
│   └── shared/       # Paylasimli TypeScript tipleri
├── database/
│   └── init.sql      # PostgreSQL schema
└── docker-compose.yml
```
