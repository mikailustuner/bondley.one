import asyncio
from app.db.session import async_session_factory
from app.services.kap_fetcher import get_kap_data_for_isin

async def main():
    async with async_session_factory() as s:
        kap_data = await get_kap_data_for_isin(s, "TRSAKFK42636", force_refresh=True)
        import json
        print(json.dumps(kap_data.get("coupon_payments", []), indent=2))

asyncio.run(main())
