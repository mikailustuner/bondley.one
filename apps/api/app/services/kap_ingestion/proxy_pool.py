from __future__ import annotations

import ipaddress
import random
from urllib.parse import urlsplit


def parse_public_proxy_list(
    body: bytes,
    *,
    max_pool_size: int,
) -> list[str]:
    """Parse and constrain an untrusted public HTTP proxy list.

    Only globally routable numeric IP addresses are accepted. Hostnames,
    credentials, private/link-local/loopback ranges and unsupported schemes are
    rejected so a third-party list cannot turn the worker into an SSRF client.
    """

    accepted: list[str] = []
    seen: set[str] = set()
    for raw_line in body.decode("utf-8", errors="replace").splitlines():
        candidate = raw_line.strip()
        if not candidate or candidate.startswith("#"):
            continue
        if "://" not in candidate:
            candidate = f"http://{candidate}"
        parsed = urlsplit(candidate)
        if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
            continue
        try:
            hostname = parsed.hostname
            port = parsed.port
        except ValueError:
            continue
        if hostname is None or port is None:
            continue
        try:
            address = ipaddress.ip_address(hostname)
        except ValueError:
            continue
        if not address.is_global or not (1 <= port <= 65535):
            continue
        formatted_address = (
            f"[{address.compressed}]" if address.version == 6 else address.compressed
        )
        normalized = f"{parsed.scheme}://{formatted_address}:{port}"
        if normalized not in seen:
            seen.add(normalized)
            accepted.append(normalized)

    # Avoid always concentrating traffic on the provider's first entries.
    random.SystemRandom().shuffle(accepted)
    return accepted[: max(1, max_pool_size)]
