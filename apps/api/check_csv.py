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