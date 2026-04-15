import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.tlref_rate import TLREFRate
from app.core.config import get_settings

async def check():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        result = await db.execute(select(TLREFRate).order_by(TLREFRate.rate_date.desc()).limit(5))
        records = result.scalars().all()
        for r in records:
            print(f"Date: {r.rate_date}, Index: {r.index_value}, Rate: {r.daily_rate}, Source: {r.source}")

if __name__ == "__main__":
    asyncio.run(check())
