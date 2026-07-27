from __future__ import annotations

import asyncio
import hashlib
import logging
import random
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx


logger = logging.getLogger(__name__)
DISCLOSURE_LINK_RE = re.compile(r"/(?:tr/)?Bildirim/(\d+)", re.IGNORECASE)


class KapAccessBlocked(RuntimeError):
    """Raised when KAP explicitly rejects or throttles the client."""


@dataclass(frozen=True)
class KapArtifact:
    url: str
    body: bytes
    content_type: str | None
    sha256: str
    storage_key: str
    fetched_at: datetime


def redact_proxy_url(url: str | None) -> str:
    if not url:
        return "DIRECT"
    parsed = urlsplit(url)
    host = parsed.hostname or "unknown"
    port = f":{parsed.port}" if parsed.port else ""
    return urlunsplit((parsed.scheme, f"{host}{port}", "", "", ""))


def parse_retry_after(value: str | None, now: datetime | None = None) -> float:
    if not value:
        return 60.0
    try:
        return max(1.0, float(value))
    except ValueError:
        try:
            target = parsedate_to_datetime(value)
            current = now or datetime.now(timezone.utc)
            if target.tzinfo is None:
                target = target.replace(tzinfo=timezone.utc)
            return max(1.0, (target - current).total_seconds())
        except (TypeError, ValueError, OverflowError):
            return 60.0


class KapHttpClient:
    """Rate-limited KAP HTTP client with conservative proxy failover.

    Every route in this client shares one limiter. PostgreSQL advisory locking
    serializes KAP workflows across worker processes. A proxy is changed only
    after a transport failure; HTTP 429 pauses the complete pool and HTTP 403
    opens the circuit.
    """

    def __init__(
        self,
        *,
        archive_root: str,
        proxy_urls: list[str] | None = None,
        request_interval_seconds: float = 2.0,
        jitter_min_ms: int = 250,
        jitter_max_ms: int = 750,
        timeout_seconds: float = 30.0,
        user_agent: str,
    ) -> None:
        self.archive_root = Path(archive_root)
        # Supplying proxies is an explicit routing choice: do not silently
        # bypass them through the server's direct egress.
        self.routes: list[str | None] = list(proxy_urls) if proxy_urls else [None]
        self.request_interval_seconds = max(0.1, request_interval_seconds)
        self.jitter_min_ms = max(0, jitter_min_ms)
        self.jitter_max_ms = max(self.jitter_min_ms, jitter_max_ms)
        self.timeout_seconds = timeout_seconds
        self.user_agent = user_agent
        self._lock = asyncio.Lock()
        self._next_request_at = 0.0
        self._pool_blocked_until = 0.0
        self.server_retry_delays = (30.0, 120.0, 600.0)

    async def _wait_for_slot(self) -> None:
        loop = asyncio.get_running_loop()
        async with self._lock:
            now = loop.time()
            await asyncio.sleep(max(0.0, self._pool_blocked_until - now, self._next_request_at - now))
            jitter = random.uniform(self.jitter_min_ms, self.jitter_max_ms) / 1000
            self._next_request_at = loop.time() + self.request_interval_seconds + jitter

    async def get(self, url: str) -> KapArtifact:
        return await self._request("GET", url)

    async def post_json(self, url: str, payload: dict[str, Any]) -> KapArtifact:
        return await self._request("POST", url, json_payload=payload)

    async def _request(
        self,
        method: str,
        url: str,
        *,
        json_payload: dict[str, Any] | None = None,
    ) -> KapArtifact:
        last_transport_error: Exception | None = None
        for route in self.routes:
            for server_attempt in range(len(self.server_retry_delays) + 1):
                await self._wait_for_slot()
                try:
                    async with httpx.AsyncClient(
                        proxy=route,
                        timeout=self.timeout_seconds,
                        follow_redirects=True,
                        headers={
                            "User-Agent": self.user_agent,
                            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
                        },
                    ) as client:
                        response = await client.request(method, url, json=json_payload)
                except httpx.TransportError as exc:
                    last_transport_error = exc
                    logger.warning(
                        "KAP transport error via %s: %s",
                        redact_proxy_url(route),
                        type(exc).__name__,
                    )
                    break

                if response.status_code == 429:
                    pause = parse_retry_after(response.headers.get("Retry-After"))
                    self._pool_blocked_until = asyncio.get_running_loop().time() + pause
                    raise KapAccessBlocked(f"KAP_RATE_LIMITED retry_after_seconds={pause:g}")
                if response.status_code == 403:
                    self._pool_blocked_until = asyncio.get_running_loop().time() + 3600
                    raise KapAccessBlocked("KAP_ACCESS_FORBIDDEN circuit_open_seconds=3600")
                if 500 <= response.status_code < 600 and server_attempt < len(
                    self.server_retry_delays
                ):
                    await asyncio.sleep(self.server_retry_delays[server_attempt])
                    continue
                response.raise_for_status()
                return self._archive(
                    str(response.url),
                    response.content,
                    response.headers.get("content-type"),
                )
        raise httpx.TransportError("All configured KAP routes failed") from last_transport_error

    def _archive(self, url: str, body: bytes, content_type: str | None) -> KapArtifact:
        digest = hashlib.sha256(body).hexdigest()
        fetched_at = datetime.now(timezone.utc)
        suffix = ".json" if content_type and "json" in content_type.casefold() else ".html"
        relative = Path(fetched_at.strftime("%Y/%m/%d")) / f"{digest}{suffix}"
        target = self.archive_root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_bytes(body)
        return KapArtifact(
            url=url,
            body=body,
            content_type=content_type,
            sha256=digest,
            storage_key=str(relative),
            fetched_at=fetched_at,
        )


def disclosure_links(body: bytes, base_url: str) -> list[tuple[str, str]]:
    text = body.decode("utf-8", errors="replace")
    seen: set[str] = set()
    result: list[tuple[str, str]] = []
    for match in DISCLOSURE_LINK_RE.finditer(text):
        disclosure_id = match.group(1)
        if disclosure_id not in seen:
            seen.add(disclosure_id)
            result.append((disclosure_id, urljoin(base_url, match.group(0))))
    return result
