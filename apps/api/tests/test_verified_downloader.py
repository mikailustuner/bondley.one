import io
import zipfile
import asyncio

import httpx
import pytest

from app.services.bist_ingestion.downloader import SafeBistDownloader


def _zip(name: str, content: bytes = b"data") -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(name, content)
    return output.getvalue()


def test_rejects_zip_path_traversal(tmp_path):
    downloader = SafeBistDownloader(tmp_path)
    with pytest.raises(ValueError, match="Unsafe ZIP member"):
        downloader.validate_content(_zip("../escape.csv"), expected_kind="benchmark_zip")


def test_rejects_html_as_csv(tmp_path):
    downloader = SafeBistDownloader(tmp_path)
    with pytest.raises(ValueError, match="received HTML"):
        downloader.validate_content(b"<!DOCTYPE html><html></html>", expected_kind="csv")


def test_accepts_bounded_zip(tmp_path):
    SafeBistDownloader(tmp_path).validate_content(
        _zip("TLREFORANI_D.csv", b"date;value"),
        expected_kind="benchmark_zip",
    )


def test_transient_http_failure_is_retried(monkeypatch, tmp_path):
    attempts = 0

    async def no_wait(_seconds):
        return None

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, request=request)
        return httpx.Response(
            200,
            request=request,
            content=_zip("tbliste_20260724.xls", b"verified"),
            headers={"content-type": "application/zip"},
        )

    monkeypatch.setattr(asyncio, "sleep", no_wait)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await SafeBistDownloader(tmp_path, retries=2).fetch(
                "https://borsaistanbul.com/datum/tbliste.zip",
                expected_kind="tbliste_zip",
                client=client,
            )

    artifact = asyncio.run(run())
    assert attempts == 2
    assert artifact.byte_size > 0
