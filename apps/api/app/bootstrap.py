from __future__ import annotations

import argparse
import asyncio
import json

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.services.bist_ingestion.bootstrap import VerifiedBistBootstrapService


async def _run(force: bool) -> None:
    settings = get_settings()
    settings.validate_production_secrets()
    if not settings.BIST_BOOTSTRAP_ENABLED:
        print('{"status":"SKIPPED","reason":"BIST_BOOTSTRAP_ENABLED=false"}')
        return
    async with async_session_factory() as db:
        result = await VerifiedBistBootstrapService(db, settings).run(force=force)
        print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bootstrap verified BIST data after database migrations."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Run freshness imports even when verified data already exists.",
    )
    args = parser.parse_args()
    asyncio.run(_run(force=args.force))


if __name__ == "__main__":
    main()
