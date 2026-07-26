import hashlib
import os
import asyncio
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.bist_ingestion import (
    BenchmarkObservation,
    ImportRun,
    Instrument,
    InstrumentVersion,
)
from app.services.bist_ingestion.downloader import DownloadedArtifact
from app.services.bist_ingestion.import_service import VerifiedBistImportService


pytestmark = pytest.mark.skipif(
    os.getenv("RUN_BIST_DB_INTEGRATION") != "1",
    reason="Set RUN_BIST_DB_INTEGRATION=1 against an isolated migrated PostgreSQL database",
)


class FixtureDownloader:
    def __init__(self, root: Path):
        self.root = root

    async def fetch(self, url: str, *, expected_kind: str, client=None) -> DownloadedArtifact:
        del expected_kind, client
        filename = url.rsplit("/", 1)[-1]
        content = (self.root / filename).read_bytes()
        digest = hashlib.sha256(content).hexdigest()
        return DownloadedArtifact(
            source_url=url,
            filename=filename,
            content=content,
            content_type="application/zip",
            etag=None,
            last_modified=None,
            downloaded_at=datetime.now(timezone.utc),
            sha256=digest,
            byte_size=len(content),
            storage_key=f"fixture/{digest}/{filename}",
        )


def test_official_files_publish_atomically_and_idempotently():
    asyncio.run(_run_import_check())


async def _run_import_check():
    root = Path(os.environ["BIST_AUDIT_FIXTURE_DIR"])
    database_url = os.environ["BIST_INTEGRATION_DATABASE_URL"]
    engine = create_async_engine(database_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with session_factory() as db:
            service = VerifiedBistImportService(
                db,
                archive_root="/tmp/unused-bist-archive",
                downloader=FixtureDownloader(root),
            )
            tbliste = await service.import_tbliste(
                "https://borsaistanbul.com/datum/tbliste.zip"
            )
            assert tbliste["status"] == "published"

            repeated = await service.import_tbliste(
                "https://borsaistanbul.com/datum/tbliste.zip"
            )
            assert repeated["status"] == "already_published"
            assert repeated["import_run_id"] == tbliste["import_run_id"]

            tlref = await service.import_benchmark_pair(
                "TLREF",
                rate_url="https://www.borsaistanbul.com/datum/TLREFORANI_D.zip",
                index_url="https://www.borsaistanbul.com/datum/BISTTLREFENDEKSI_D.zip",
                historical=True,
            )
            tlrefk = await service.import_benchmark_pair(
                "TLREFK",
                rate_url="https://www.borsaistanbul.com/datum/TLREFKORANI_D.zip",
                index_url="https://www.borsaistanbul.com/datum/BISTTLREFKENDEKSI_D.zip",
                historical=True,
            )
            assert tlref["status"] == "published"
            assert tlrefk["status"] == "published"

            assert await db.scalar(select(func.count(Instrument.id))) == 2135
            assert await db.scalar(select(func.count(InstrumentVersion.id))) == 2136
            assert await db.scalar(select(func.count(ImportRun.id))) == 3
            assert (
                await db.scalar(
                    select(func.count(BenchmarkObservation.id)).where(
                        BenchmarkObservation.benchmark == "TLREF"
                    )
                )
                == 1896
            )
            assert (
                await db.scalar(
                    select(func.count(BenchmarkObservation.id)).where(
                        BenchmarkObservation.benchmark == "TLREFK"
                    )
                )
                == 1027
            )
    finally:
        await engine.dispose()
