# Legacy Retirement Report

Kapatılan yollar: v1 bond/TLREF sync, v1 CSV import, sentetik market-data,
eski günlük calculations ve bunların Celery görevleri.

Korunan kullanıcı verileri: users, refresh tokens, eski favori/not rollback
kopyaları, audit, bildirim, alert ve kullanıcı metrikleri.

Eski `bonds`, `market_data`, `calculations` ve `tlref_rates` tabloları üretim
yedeği olmadan düşürülmez; v2 bunlara yazmaz. KAP kodu korunur fakat v2 BIST
importu ve değerleme motorunun bağımlılığı değildir.
