
import asyncio
import re
from decimal import Decimal
from sqlalchemy import text, select
from app.core.database import SessionLocal
from app.models.bond import Bond
from app.services.bond_metrics_service import _extract_spread_from_remarks

async def setup_dashspread():
    async with SessionLocal() as db:
        # 1. Kolonu ekle (eğer yoksa)
        print("Veritabanına dashspread kolonu ekleniyor...")
        await db.execute(text("ALTER TABLE bonds ADD COLUMN IF NOT EXISTS dashspread NUMERIC(12, 6)"))
        await db.commit()
        
        # 2. Verileri doldur
        print("Açıklamalardan (remarks) veriler çıkarılıyor ve dashspread kolonu dolduruluyor...")
        stmt = select(Bond).where(Bond.is_active == True)
        result = await db.execute(stmt)
        bonds = result.scalars().all()
        
        updates = 0
        for b in bonds:
            # Önce remarks'tan çekmeye çalış
            extracted = _extract_spread_from_remarks(b.remarks)
            if extracted is not None:
                b.dashspread = extracted * 100
                updates += 1
            # Eğer remarks boşsa ama statik spread varsa onu da dashboard için kopyalayalım
            elif b.spread is not None:
                b.dashspread = b.spread
                updates += 1
                
        await db.commit()
        print(f"İşlem tamamlandı. {updates} adet tahvil için dashspread güncellendi.")

if __name__ == "__main__":
    asyncio.run(setup_dashspread())
