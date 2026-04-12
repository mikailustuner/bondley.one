"""
Toplu tarih güncelleme scripti
Veritabanındaki market_data ve calculations tablolarındaki tarihleri toplu olarak günceller.

Kullanım:
    python update-dates.py

Dikkat: Bu script veritabanındaki verileri kalıcı olarak değiştirir!
"""

import sys
import asyncio
from pathlib import Path
from datetime import date, timedelta
from sqlalchemy import text

# Proje root'unu bul
project_root = Path(__file__).parent.resolve()
if (project_root / "apps" / "api").exists():
    sys.path.insert(0, str(project_root / "apps" / "api"))

try:
    from app.core.database import engine
    from app.core.config import get_settings
except ImportError as e:
    print(f"HATA: Modul import edilemedi: {e}")
    print("Lutfen proje dizininde calistirdiginizdan emin olun.")
    sys.exit(1)


async def preview_changes(days_offset: int, table: str, date_field: str, where_clause: str = ""):
    """Güncelleme öncesi önizleme göster"""
    where_sql = f"WHERE {where_clause}" if where_clause else ""
    
    query = f"""
    SELECT 
        {date_field} as current_date,
        {date_field} + INTERVAL '{days_offset} days' as new_date,
        COUNT(*) as count
    FROM {table}
    {where_sql}
    GROUP BY {date_field}
    ORDER BY {date_field} DESC
    LIMIT 20
    """
    
    async with engine.begin() as conn:
        result = await conn.execute(text(query))
        rows = result.fetchall()
        
        if not rows:
            print(f"  {table}: Etkilenecek kayıt bulunamadı")
            return
        
        print(f"\n{table} - Önizleme (ilk 20 tarih):")
        print(f"{'Mevcut Tarih':<15} {'Yeni Tarih':<15} {'Kayıt Sayısı':<15}")
        print("-" * 45)
        for row in rows:
            print(f"{str(row[0]):<15} {str(row[1]):<15} {row[2]:<15}")


async def update_dates(
    days_offset: int,
    table: str,
    date_field: str,
    where_clause: str = "",
    dry_run: bool = True
):
    """Tarihleri güncelle"""
    where_sql = f"WHERE {where_clause}" if where_clause else ""
    
    if days_offset == 0:
        print(f"  {table}: Güncelleme gerekmiyor (days_offset=0)")
        return
    
    sign = "+" if days_offset > 0 else ""
    update_query = f"""
    UPDATE {table}
    SET {date_field} = {date_field} {sign} INTERVAL '{abs(days_offset)} days'
    {where_sql}
    """
    
    count_query = f"SELECT COUNT(*) FROM {table} {where_sql}"
    
    async with engine.begin() as conn:
        # Önce kaç kayıt etkilenecek?
        result = await conn.execute(text(count_query))
        count = result.scalar()
        
        if count == 0:
            print(f"  {table}: Etkilenecek kayıt yok")
            return
        
        print(f"  {table}: {count} kayıt etkilenecek")
        
        if dry_run:
            print(f"  [DRY RUN] Güncelleme yapılmadı")
            return
        
        # Güncellemeyi yap
        await conn.execute(text(update_query))
        print(f"  ✓ {table}: {count} kayıt güncellendi")


async def main():
    """Ana fonksiyon"""
    print("="*60)
    print("TOPLU TARIH GUNCELLEME SCRIPTI")
    print("="*60)
    print("\n⚠️  DİKKAT: Bu script veritabanındaki verileri kalıcı olarak değiştirir!")
    print("    İşlem öncesi mutlaka backup alın!\n")
    
    # Güncelleme tipi seçimi
    print("Güncelleme tipi:")
    print("  1. Tüm kayıtları güncelle")
    print("  2. Belirli bir tahvil (ISIN kodu)")
    print("  3. Belirli bir tarih aralığı")
    print("  4. Belirli bir tarihi başka tarihe çevir")
    
    choice = input("\nSeçiminiz (1-4): ").strip()
    
    days_offset = 0
    isin_code = None
    start_date = None
    end_date = None
    old_date = None
    new_date = None
    
    if choice == "1":
        days_str = input("Kaç gün ileriye/geriye almak istiyorsunuz? (+1, -1, +7, vb.): ").strip()
        try:
            days_offset = int(days_str)
        except ValueError:
            print("HATA: Geçersiz gün sayısı")
            return
    
    elif choice == "2":
        isin_code = input("ISIN kodunu girin: ").strip()
        if not isin_code:
            print("HATA: ISIN kodu gerekli")
            return
        
        days_str = input("Kaç gün ileriye/geriye almak istiyorsunuz? (+1, -1, +7, vb.): ").strip()
        try:
            days_offset = int(days_str)
        except ValueError:
            print("HATA: Geçersiz gün sayısı")
            return
    
    elif choice == "3":
        start_date_str = input("Başlangıç tarihi (YYYY-MM-DD): ").strip()
        end_date_str = input("Bitiş tarihi (YYYY-MM-DD): ").strip()
        try:
            start_date = date.fromisoformat(start_date_str)
            end_date = date.fromisoformat(end_date_str)
        except ValueError:
            print("HATA: Geçersiz tarih formatı")
            return
        
        days_str = input("Kaç gün ileriye/geriye almak istiyorsunuz? (+1, -1, +7, vb.): ").strip()
        try:
            days_offset = int(days_str)
        except ValueError:
            print("HATA: Geçersiz gün sayısı")
            return
    
    elif choice == "4":
        old_date_str = input("Değiştirilecek tarih (YYYY-MM-DD): ").strip()
        new_date_str = input("Yeni tarih (YYYY-MM-DD): ").strip()
        try:
            old_date = date.fromisoformat(old_date_str)
            new_date = date.fromisoformat(new_date_str)
            days_offset = (new_date - old_date).days
        except ValueError:
            print("HATA: Geçersiz tarih formatı")
            return
    
    else:
        print("HATA: Geçersiz seçim")
        return
    
    # Dry run kontrolü
    dry_run_input = input("\nDry run yapmak istiyor musunuz? (sadece önizleme, güncelleme yapmaz) [E/h]: ").strip().lower()
    dry_run = dry_run_input != 'h'
    
    if dry_run:
        print("\n[DRY RUN MODU] - Sadece önizleme yapılacak, güncelleme yapılmayacak")
    else:
        confirm = input("\n⚠️  GERÇEKTEN GÜNCELLEME YAPMAK İSTİYOR MUSUNUZ? (evet yazın): ").strip()
        if confirm.lower() != "evet":
            print("İşlem iptal edildi")
            return
    
    print("\n" + "="*60)
    print("GÜNCELLEME BAŞLIYOR...")
    print("="*60)
    
    # Where clause oluştur
    where_clauses = []
    
    if isin_code:
        where_clauses.append(f"bond_id = (SELECT id FROM bonds WHERE isin_code = '{isin_code}')")
    
    if start_date and end_date:
        where_clauses.append(f"trade_date BETWEEN '{start_date}' AND '{end_date}'")
    
    if old_date:
        where_clauses.append(f"trade_date = '{old_date}'")
    
    where_clause = " AND ".join(where_clauses) if where_clauses else ""
    
    # Önizleme göster
    if dry_run:
        print("\nÖNİZLEME:")
        await preview_changes(days_offset, "market_data", "trade_date", where_clause)
        await preview_changes(days_offset, "calculations", "calc_date", where_clause.replace("trade_date", "calc_date"))
    
    # Güncellemeleri yap
    print("\nGÜNCELLEMELER:")
    
    if old_date and new_date:
        # Belirli tarihi başka tarihe çevir
        async with engine.begin() as conn:
            if not dry_run:
                await conn.execute(
                    text(f"UPDATE market_data SET trade_date = '{new_date}' WHERE trade_date = '{old_date}'")
                )
                await conn.execute(
                    text(f"UPDATE calculations SET calc_date = '{new_date}' WHERE calc_date = '{old_date}'")
                )
                print(f"✓ Tarih {old_date} -> {new_date} olarak güncellendi")
    else:
        # Gün offset ile güncelle
        await update_dates(days_offset, "market_data", "trade_date", where_clause, dry_run)
        await update_dates(days_offset, "calculations", "calc_date", where_clause.replace("trade_date", "calc_date"), dry_run)
    
    print("\n" + "="*60)
    if dry_run:
        print("DRY RUN TAMAMLANDI - Hiçbir değişiklik yapılmadı")
        print("Gerçek güncelleme için script'i tekrar çalıştırın ve 'h' seçeneğini seçin")
    else:
        print("GÜNCELLEME TAMAMLANDI!")
    print("="*60)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nİşlem kullanıcı tarafından iptal edildi")
    except Exception as e:
        print(f"\nHATA: {e}")
        import traceback
        traceback.print_exc()
