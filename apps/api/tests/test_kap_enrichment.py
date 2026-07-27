from datetime import date, datetime, timezone
from decimal import Decimal
import asyncio

import httpx
import pytest

from app.services.kap_ingestion.client import (
    KapAccessBlocked,
    KapHttpClient,
    disclosure_links,
    parse_retry_after,
    redact_proxy_url,
)
from app.services.kap_ingestion.parser import KapDisclosureParser
from app.services.kap_ingestion.spread_derivation import (
    derive_annual_simple_spread,
)
from app.services.kap_ingestion.service import KapEnrichmentService
from app.services.kap_ingestion.proxy_pool import parse_public_proxy_list


def test_kap_redemption_plan_parser_preserves_rates_and_amounts():
    html = """
    <html><body>
      <h1>Sermaye Piyasası Aracının İtfa Planı</h1>
      <div>ISIN Kodu TRFDVYS42711</div>
      <div>Yıllık Basit Ek Getiri (%) 1,15</div>
      <table>
        <tr>
          <th>Kupon Sıra No</th><th>Ödeme Tarihi</th><th>Kayıt Tarihi</th>
          <th>Yatırımcı Hesaplarına Ödenme Tarihi</th>
          <th>Faiz Oranı - Dönemsel (%)</th>
          <th>Faiz Oranı - Yıllık Basit (%)</th>
          <th>Faiz Oranı - Yıllık Bileşik (%)</th>
          <th>Ödeme Tutarı</th><th>Döviz Kuru</th>
          <th>Ödemesi Gerçekleştirildi mi?</th>
        </tr>
        <tr>
          <td>1</td><td>27.07.2026</td><td>24.07.2026</td><td>27.07.2026</td>
          <td>11,4037</td><td>45,7402</td><td>54,2106</td>
          <td>58.421.155,1</td><td></td><td>Evet</td>
        </tr>
        <tr>
          <td>2</td><td>26.10.2026</td><td>23.10.2026</td><td>26.10.2026</td>
          <td></td><td></td><td></td><td></td><td></td><td></td>
        </tr>
      </table>
    </body></html>
    """
    parsed = KapDisclosureParser().parse(html.encode(), "text/html; charset=utf-8")

    assert parsed.isin == "TRFDVYS42711"
    assert parsed.explicit_annual_simple_spread == Decimal("0.0115")
    assert len(parsed.events) == 2
    first = parsed.events[0]
    assert first.payment_date == date(2026, 7, 27)
    assert first.record_date == date(2026, 7, 24)
    assert first.periodic_rate_decimal == Decimal("0.114037")
    assert first.annual_simple_decimal == Decimal("0.457402")
    assert first.annual_compound_decimal == Decimal("0.542106")
    assert first.payment_amount == Decimal("58421155.1")
    assert first.paid is True
    assert parsed.events[1].periodic_rate_decimal is None


def test_spread_derivation_reconstructs_trd_qnb_coupon_to_source_rounding():
    evidence = derive_annual_simple_spread(
        published_periodic_rate=Decimal("0.105194"),
        period_start=date(2026, 2, 11),
        period_end=date(2026, 5, 13),
        index_observations={
            date(2026, 2, 10): Decimal("3303.79554"),
            date(2026, 5, 12): Decimal("3641.86408"),
        },
        candidate_lags=(1,),
        source_rounding_decimal_places=6,
    )

    assert evidence is not None
    assert evidence.spread_decimal == Decimal("0.0115")
    assert evidence.lag_business_days == 1
    assert evidence.error_decimal <= Decimal("0.0000005")


def test_proxy_credentials_are_never_exposed_and_429_date_is_respected():
    assert (
        redact_proxy_url("http://secret-user:secret-pass@proxy.example:8080/path")
        == "http://proxy.example:8080"
    )
    now = datetime(2026, 7, 27, 12, 0, tzinfo=timezone.utc)
    assert parse_retry_after("120", now) == 120
    assert parse_retry_after("Mon, 27 Jul 2026 12:03:00 GMT", now) == 180


def test_disclosure_list_is_deduplicated():
    body = (
        b'<a href="/tr/Bildirim/123">one</a>'
        b'<a href="/tr/Bildirim/123">duplicate</a>'
        b'<a href="/tr/Bildirim/456">two</a>'
    )
    assert disclosure_links(body, "https://www.kap.org.tr") == [
        ("123", "https://www.kap.org.tr/tr/Bildirim/123"),
        ("456", "https://www.kap.org.tr/tr/Bildirim/456"),
    ]


def test_public_list_json_keeps_only_debt_coupon_disclosures():
    body = """[
      {
        "disclosureIndex": 1637000,
        "subject": "Pay Dışında Sermaye Piyasası Aracı İşlemlerine İlişkin Bildirim (Faiz İçeren)",
        "summary": "TRFTEST72610 kupon oranı"
      },
      {
        "disclosureIndex": 1637001,
        "subject": "Pay Bazında Devre Kesici Bildirimi",
        "summary": "İşlem sırası"
      }
    ]""".encode()
    links, metadata = KapEnrichmentService._list_entries(
        body,
        "https://www.kap.org.tr",
    )

    assert links == [
        ("1637000", "https://www.kap.org.tr/tr/Bildirim/1637000")
    ]
    assert metadata["1637000"]["summary"] == "TRFTEST72610 kupon oranı"
    assert KapEnrichmentService._list_payload(
        date(2026, 7, 25),
        date(2026, 7, 27),
    )["fromDate"] == "2026-07-25"


def test_429_does_not_rotate_proxy(monkeypatch, tmp_path):
    routes: list[str | None] = []

    class FakeClient:
        def __init__(self, *, proxy=None, **_kwargs):
            routes.append(proxy)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def request(self, method, url, json=None):
            request = httpx.Request(method, url)
            return httpx.Response(429, headers={"Retry-After": "120"}, request=request)

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    client = KapHttpClient(
        archive_root=str(tmp_path),
        proxy_urls=["http://proxy.example:8080"],
        request_interval_seconds=0.1,
        jitter_min_ms=0,
        jitter_max_ms=0,
        user_agent="test",
    )
    with pytest.raises(KapAccessBlocked, match="KAP_RATE_LIMITED"):
        asyncio.run(client.get("https://www.kap.org.tr/test"))
    assert routes == ["http://proxy.example:8080"]


def test_transport_failure_can_fail_over_to_proxy(monkeypatch, tmp_path):
    routes: list[str | None] = []

    class FakeClient:
        def __init__(self, *, proxy=None, **_kwargs):
            self.proxy = proxy
            routes.append(proxy)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def request(self, method, url, json=None):
            request = httpx.Request(method, url)
            if "proxy-a" in self.proxy:
                raise httpx.ConnectError("network", request=request)
            return httpx.Response(
                200,
                content=b"ok",
                headers={"content-type": "text/plain"},
                request=request,
            )

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    client = KapHttpClient(
        archive_root=str(tmp_path),
        proxy_urls=[
            "http://user:password@proxy-a.example:8080",
            "http://user:password@proxy-b.example:8080",
        ],
        request_interval_seconds=0.1,
        jitter_min_ms=0,
        jitter_max_ms=0,
        user_agent="test",
    )
    artifact = asyncio.run(client.get("https://www.kap.org.tr/test"))
    assert artifact.body == b"ok"
    assert routes == [
        "http://user:password@proxy-a.example:8080",
        "http://user:password@proxy-b.example:8080",
    ]


def test_public_proxy_list_rejects_private_hosts_credentials_and_bad_schemes():
    result = parse_public_proxy_list(
        b"\n".join(
            [
                b"8.8.8.8:8080",
                b"https://1.1.1.1:443",
                b"http://127.0.0.1:8080",
                b"http://10.0.0.2:3128",
                b"http://user:pass@9.9.9.9:80",
                b"socks5://8.8.4.4:1080",
                b"http://not-an-ip.example:80",
                b"http://8.8.8.8:not-a-port",
            ]
        ),
        max_pool_size=10,
    )
    assert sorted(result) == [
        "http://8.8.8.8:8080",
        "https://1.1.1.1:443",
    ]
