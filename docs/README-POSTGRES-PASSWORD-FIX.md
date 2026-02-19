# PostgreSQL Şifre Sorunu Çözümü

## Sorun

PostgreSQL container'ı ilk başlatıldığında `.env` dosyasındaki şifreyle kullanıcı oluşturulur. Eğer sonradan `.env` dosyasındaki şifre değiştirilirse, PostgreSQL container'ındaki kullanıcının şifresi otomatik olarak güncellenmez çünkü şifre PostgreSQL volume'unda saklanır.

## Hızlı Çözüm

### Yöntem 1: Script ile Otomatik Düzeltme (Önerilen)

**Linux/Mac:**
```bash
chmod +x fix-postgres-password.sh
./fix-postgres-password.sh
```

**Windows (PowerShell):**
```powershell
.\fix-postgres-password.ps1
```

### Yöntem 2: Manuel Düzeltme

1. **PostgreSQL container'ına bağlanın:**
   ```bash
   docker exec -it fincalc-postgres psql -U postgres -d postgres
   ```

2. **Şifreyi güncelleyin:**
   ```sql
   ALTER USER fincalc WITH PASSWORD 'jlmtDfdg4UhXmAYrR7AYDu-Nigc8XF22_3H4i0WUyWA';
   ```

3. **Çıkış yapın:**
   ```sql
   \q
   ```

4. **API container'ını yeniden başlatın:**
   ```bash
   docker-compose -f docker-compose.prod.yml restart api
   ```

### Yöntem 3: Container ve Volume'u Yeniden Oluşturma (Veri Kaybı)

⚠️ **DİKKAT: Bu yöntem TÜM VERİLERİ SİLER!**

```bash
# Container'ı durdur
docker-compose -f docker-compose.prod.yml stop postgres

# Container'ı sil
docker-compose -f docker-compose.prod.yml rm -f postgres

# Volume'u sil
docker volume rm fincalc_postgres_data

# Container'ı yeniden başlat (.env'deki yeni şifreyle)
docker-compose -f docker-compose.prod.yml up -d postgres

# API container'ını yeniden başlat
docker-compose -f docker-compose.prod.yml restart api
```

## Sorunun Nedeni

PostgreSQL container'ı ilk başlatıldığında:
1. Volume boşsa, `init.sql` çalışır ve kullanıcı oluşturulur
2. Volume'da eski şifreyle kullanıcı kaydedilir
3. Container yeniden başlatılsa bile volume'daki şifre değişmez

## Önleme

Gelecekte bu sorunu önlemek için:
- `.env` dosyasındaki şifreyi değiştirmeden önce PostgreSQL container'ını durdurun
- Şifreyi güncelledikten sonra container'ı yeniden başlatın ve şifreyi manuel olarak güncelleyin
- Veya `fix-postgres-password.sh` script'ini kullanın

## Doğrulama

Şifrenin doğru güncellendiğini kontrol edin:

```bash
# Yeni şifre ile bağlanmayı deneyin
docker exec -e PGPASSWORD='jlmtDfdg4UhXmAYrR7AYDu-Nigc8XF22_3H4i0WUyWA' fincalc-postgres psql -U fincalc -d fincalc -c "SELECT 1;"
```

Başarılı olursa şifre doğru güncellenmiştir.
