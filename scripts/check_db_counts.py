import asyncio
import sys
from pathlib import Path
from datetime import date

# API dizinini yola ekle
project_root = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(project_root / "apps" / "api"))

from app.core.database import async_session_factory, engine
from app.models.bond import Bond
from sqlalchemy import select, func

async def check():
    async with async_session_factory() as s:
        # 1. Toplam aktif işaretli olanlar
        total = (await s.execute(select(func.count(Bond.id)).where(Bond.is_active == True))).scalar()
        
        # 2. Vadesi dolmamış olanlar
        active_circ = (await s.execute(
            select(func.count(Bond.id)).where(Bond.is_active == True, Bond.maturity_date >= date.today())
        )).scalar()
        
        # 3. Vadesi geçmiş ama hala aktif olanlar
        matured = (await s.execute(
            select(func.count(Bond.id)).where(Bond.is_active == True, Bond.maturity_date < date.today())
        )).scalar()
        
        # 4. Vade tarihi hiç girilmemiş olanlar
        no_maturity = (await s.execute(
            select(func.count(Bond.id)).where(Bond.is_active == True, Bond.maturity_date.is_(None))
        )).scalar()

        print("-" * 40)
        print(f"Bugünün Tarihi: {date.today()}")
        print(f"Toplam Aktif (is_active=True): {total}")
        print(f"Dolaşımda (Maturity >= Today): {active_circ}")
        print(f"Vadesi Geçmiş (Maturity < Today): {matured}")
        print(f"Vade Tarihi Yok: {no_maturity}")
        print("-" * 40)

if __name__ == "__main__":
    asyncio.run(check())
