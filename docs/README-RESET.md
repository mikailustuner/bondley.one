# Veritabanı Sıfırlama

Bu script'ler veritabanındaki tüm verileri siler ve veritabanını yeniden kurar.

## Kullanım

### Linux/Mac:
```bash
./reset-db.sh
```

### Windows (PowerShell):
```powershell
.\reset-db.ps1
```

## Ne Yapar?

1. ✅ Tüm Docker servislerini durdurur
2. ✅ PostgreSQL volume'unu siler (tüm veriler)
3. ✅ PostgreSQL'i yeniden başlatır
4. ✅ Veritabanı şemasını yeniden oluşturur (`database/init.sql`)
5. ✅ Default admin kullanıcısını oluşturur
6. ✅ Tüm servisleri başlatır

## Dikkat!

⚠️ **BU İŞLEM GERİ ALINAMAZ!**

- Tüm tahvil verileri silinir
- Tüm kullanıcı verileri silinir (admin hariç)
- Tüm loglar silinir
- Tüm metrikler silinir
- Tüm hesaplamalar silinir

## Sonrasında

Veritabanı sıfırlandıktan sonra:

1. Admin kullanıcı ile giriş yapın:
   - Email: `admin@fincalc.com`
   - Password: `admin123`

2. Tahvil verilerini yeniden yüklemek için:
   ```bash
   # API'ye admin olarak giriş yapın ve sync endpoint'ini çağırın
   POST /api/v1/bonds/sync
   ```

## Alternatif: Sadece Verileri Temizle

Eğer sadece verileri temizlemek istiyorsanız (şema korunur):

```sql
-- PostgreSQL container'a bağlanın
docker exec -it fincalc-postgres psql -U fincalc -d fincalc

-- Sonra şu komutları çalıştırın:
TRUNCATE TABLE bond_views CASCADE;
TRUNCATE TABLE user_metrics CASCADE;
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE calculations CASCADE;
TRUNCATE TABLE market_data CASCADE;
TRUNCATE TABLE bonds CASCADE;
TRUNCATE TABLE tlref_rates CASCADE;
-- users tablosunu korumak için sadece admin hariç silin:
DELETE FROM users WHERE email != 'admin@fincalc.com';
```
