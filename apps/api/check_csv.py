import httpx
import asyncio

async def check():
    urls = [
        "https://www.borsaistanbul.com/datum/tlrefkorani.csv",
        "https://www.borsaistanbul.com/datum/bisttlrefkendeksi.csv"
    ]
    async with httpx.AsyncClient() as client:
        for url in urls:
            try:
                resp = await client.get(url, timeout=10.0)
                print(f"\nURL: {url}")
                lines = resp.text.splitlines()[:5]
                for i, line in enumerate(lines):
                    print(f"Line {i}: {line}")
            except Exception as e:
                print(f"Error for {url}: {e}")

if __name__ == "__main__":
    asyncio.run(check())




docker exec -it fincalc-postgres psql -U bondley -d bondley -c "UPDATE tlref_rates SET index_value = 5714.02026 WHERE rate_date = '2026-04-16';"
docker exec -it fincalc-postgres psql -U fincalc -d fincalc -c "SELECT rate_date, index_value, daily_rate FROM tlref_rates ORDER BY rate_date DESC LIMIT 10;"
docker exec -it fincalc-postgres psql -U bondley -d bondley -c "SELECT rate_date, index_value, daily_rate FROM tlref_rates ORDER BY rate_date DESC LIMIT 10;"