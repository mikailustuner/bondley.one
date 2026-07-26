from __future__ import annotations

import asyncio
import hashlib
import io
import os
import re
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

import httpx


@dataclass(frozen=True)
class DownloadedArtifact:
    source_url: str
    filename: str
    content: bytes
    content_type: str | None
    etag: str | None
    last_modified: str | None
    downloaded_at: datetime
    sha256: str
    byte_size: int
    storage_key: str


class SafeBistDownloader:
    """Bounded downloader with immutable, checksum-addressed local archival."""

    USER_AGENT = "Bondley-BIST-Ingestion/2.1"

    def __init__(
        self,
        archive_root: str | Path,
        *,
        max_download_bytes: int = 25 * 1024 * 1024,
        max_uncompressed_bytes: int = 50 * 1024 * 1024,
        retries: int = 3,
    ):
        self.archive_root = Path(archive_root)
        self.max_download_bytes = max_download_bytes
        self.max_uncompressed_bytes = max_uncompressed_bytes
        self.retries = retries

    async def fetch(
        self,
        url: str,
        *,
        expected_kind: str,
        client: httpx.AsyncClient | None = None,
    ) -> DownloadedArtifact:
        self._validate_url(url)
        owned_client = client is None
        http_client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(connect=15, read=120, write=30, pool=15),
            follow_redirects=True,
            headers={"User-Agent": self.USER_AGENT},
        )
        try:
            response: httpx.Response | None = None
            for attempt in range(self.retries):
                try:
                    response = await http_client.get(url)
                    response.raise_for_status()
                    break
                except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError):
                    if attempt + 1 >= self.retries:
                        raise
                    await asyncio.sleep(2**attempt)
            if response is None:
                raise RuntimeError("Downloader completed without a response")
            content = response.content
            if not content or len(content) > self.max_download_bytes:
                raise ValueError(f"Invalid download size: {len(content)}")
            self.validate_content(content, expected_kind=expected_kind)
            filename = self._filename(response.url.path, expected_kind)
            digest = hashlib.sha256(content).hexdigest()
            storage_key = self._archive(content, digest, filename)
            return DownloadedArtifact(
                source_url=str(response.url),
                filename=filename,
                content=content,
                content_type=response.headers.get("content-type"),
                etag=response.headers.get("etag"),
                last_modified=response.headers.get("last-modified"),
                downloaded_at=datetime.now(timezone.utc),
                sha256=digest,
                byte_size=len(content),
                storage_key=storage_key,
            )
        finally:
            if owned_client:
                await http_client.aclose()

    def validate_content(self, content: bytes, *, expected_kind: str) -> None:
        if expected_kind in {"zip", "tbliste_zip", "benchmark_zip"}:
            if not content.startswith(b"PK"):
                raise ValueError("Expected ZIP magic bytes")
            self._validate_zip(content)
            return
        if expected_kind == "csv":
            if content.startswith(b"<html") or b"<!DOCTYPE html" in content[:256]:
                raise ValueError("Expected CSV but received HTML")
            return
        if expected_kind == "xls":
            if not content.startswith(b"\xd0\xcf\x11\xe0"):
                raise ValueError("Expected legacy XLS/OLE magic bytes")
            return
        raise ValueError(f"Unsupported expected kind: {expected_kind}")

    def _validate_zip(self, content: bytes) -> None:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            infos = archive.infolist()
            if not infos:
                raise ValueError("ZIP is empty")
            total = 0
            for info in infos:
                path = PurePosixPath(info.filename)
                if path.is_absolute() or ".." in path.parts:
                    raise ValueError(f"Unsafe ZIP member path: {info.filename}")
                if info.flag_bits & 0x1:
                    raise ValueError("Encrypted ZIP members are not accepted")
                total += info.file_size
                if total > self.max_uncompressed_bytes:
                    raise ValueError("ZIP exceeds maximum uncompressed size")
                if info.compress_size and info.file_size / info.compress_size > 200:
                    raise ValueError(f"Suspicious ZIP compression ratio: {info.filename}")

    def _archive(self, content: bytes, digest: str, filename: str) -> str:
        safe_filename = re.sub(r"[^A-Za-z0-9._-]", "_", filename)
        destination = self.archive_root / digest[:2] / digest / safe_filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            if hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
                raise ValueError("Checksum-addressed archive path contains different bytes")
            return str(destination)
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=".download-",
            dir=str(destination.parent),
        )
        try:
            with os.fdopen(descriptor, "wb") as output:
                output.write(content)
                output.flush()
                os.fsync(output.fileno())
            Path(temporary_name).replace(destination)
        finally:
            temporary = Path(temporary_name)
            if temporary.exists():
                temporary.unlink()
        return str(destination)

    @staticmethod
    def _validate_url(url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme != "https":
            raise ValueError("Only HTTPS source URLs are accepted")
        if parsed.hostname not in {"borsaistanbul.com", "www.borsaistanbul.com"}:
            raise ValueError(f"Unapproved BIST source host: {parsed.hostname}")

    @staticmethod
    def _filename(path: str, expected_kind: str) -> str:
        name = Path(path).name
        if name:
            return name
        return f"download.{expected_kind}"
