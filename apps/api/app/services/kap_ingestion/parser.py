from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from typing import Any


ISIN_RE = re.compile(r"\bTR[A-Z0-9]{10}\b")
DATE_RE = re.compile(r"^\s*(\d{2})[./-](\d{2})[./-](\d{4})\s*$")
DATETIME_RE = re.compile(r"(\d{2})[./-](\d{2})[./-](\d{4})(?:\s+(\d{2}):(\d{2}))?")


@dataclass(frozen=True)
class ParsedCouponEvent:
    isin: str
    coupon_sequence: int | None
    payment_date: date
    record_date: date | None
    investor_payment_date: date | None
    periodic_rate_decimal: Decimal | None
    annual_simple_decimal: Decimal | None
    annual_compound_decimal: Decimal | None
    payment_amount: Decimal | None
    currency_rate: Decimal | None
    paid: bool | None
    raw_row: dict[str, Any]


@dataclass(frozen=True)
class ParsedDisclosure:
    isin: str | None
    title: str | None
    published_at: datetime | None
    explicit_annual_simple_spread: Decimal | None
    events: tuple[ParsedCouponEvent, ...]
    warnings: tuple[str, ...]


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self.all_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.casefold() == "tr":
            self._row = []
        elif tag.casefold() in {"td", "th"} and self._row is not None:
            self._cell = []

    def handle_data(self, data: str) -> None:
        self.all_text.append(data)
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() in {"td", "th"} and self._cell is not None and self._row is not None:
            self._row.append(" ".join(self._cell).strip())
            self._cell = None
        elif tag.casefold() == "tr" and self._row is not None:
            if any(cell.strip() for cell in self._row):
                self.rows.append(self._row)
            self._row = None


def _date(value: str) -> date | None:
    match = DATE_RE.match(value)
    if not match:
        return None
    try:
        return date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
    except ValueError:
        return None


def _decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    text = str(value).strip().replace("\xa0", "").replace(" ", "")
    if not text or text in {"-", "—"}:
        return None
    text = re.sub(r"[^\d,.\-+]", "", text)
    if not text:
        return None
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif text.count(".") > 1:
        text = text.replace(".", "")
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def _rate(value: Any) -> Decimal | None:
    parsed = _decimal(value)
    return parsed / Decimal("100") if parsed is not None else None


def _fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    return "".join(character for character in normalized if not unicodedata.combining(character))


def _published_at(text: str) -> datetime | None:
    labelled = re.search(
        r"(?:Gönderim|Yayınlanma|Yayımlanma)\s+Tarihi(?:\s+ve\s+Saati)?"
        r"\s*[:\-]?\s*(\d{2}[./-]\d{2}[./-]\d{4}(?:\s+\d{2}:\d{2})?)",
        text,
        re.IGNORECASE,
    )
    match = DATETIME_RE.search(labelled.group(1) if labelled else text)
    if not match:
        return None
    try:
        return datetime(
            int(match.group(3)),
            int(match.group(2)),
            int(match.group(1)),
            int(match.group(4) or 0),
            int(match.group(5) or 0),
        )
    except ValueError:
        return None


def _events_from_rows(rows: list[list[str]], fallback_isin: str | None) -> list[ParsedCouponEvent]:
    events: list[ParsedCouponEvent] = []
    seen: set[tuple[str, int, date]] = set()
    for cells in rows:
        compact = [cell.strip() for cell in cells]
        if not compact:
            continue
        sequence = int(compact[0]) if compact[0].isdigit() else None
        payment_index = next((index for index, cell in enumerate(compact) if _date(cell)), None)
        if sequence is None or payment_index is None:
            continue
        payment_date = _date(compact[payment_index])
        if payment_date is None:
            continue
        tail = compact[payment_index:]
        # Canonical KAP redemption-plan order after the sequence:
        # payment, record, investor payment, periodic, annual simple,
        # annual compound, amount, FX, paid.
        values = tail + [""] * max(0, 9 - len(tail))
        row_text = " ".join(compact)
        row_isin = next(iter(ISIN_RE.findall(row_text)), fallback_isin)
        if row_isin is None:
            continue
        identity = (row_isin, sequence, payment_date)
        if identity in seen:
            continue
        seen.add(identity)
        paid_text = _fold(values[8])
        paid = True if paid_text in {"evet", "yes"} else False if paid_text in {"hayir", "no"} else None
        events.append(
            ParsedCouponEvent(
                isin=row_isin,
                coupon_sequence=sequence,
                payment_date=payment_date,
                record_date=_date(values[1]),
                investor_payment_date=_date(values[2]),
                periodic_rate_decimal=_rate(values[3]),
                annual_simple_decimal=_rate(values[4]),
                annual_compound_decimal=_rate(values[5]),
                payment_amount=_decimal(values[6]),
                currency_rate=_decimal(values[7]),
                paid=paid,
                raw_row={"cells": compact},
            )
        )
    return events


class KapDisclosureParser:
    VERSION = "kap-redemption-plan-v1"

    def parse(self, body: bytes, content_type: str | None = None) -> ParsedDisclosure:
        text = body.decode("utf-8", errors="replace")
        if content_type and "json" in content_type.casefold():
            try:
                payload = json.loads(text)
                text = json.dumps(payload, ensure_ascii=False)
            except json.JSONDecodeError:
                pass
        parser = _TableParser()
        parser.feed(text)
        visible_text = " ".join(parser.all_text) if parser.all_text else text
        isins = ISIN_RE.findall(visible_text)
        isin = isins[0] if isins else None
        events = _events_from_rows(parser.rows, isin)
        warnings: list[str] = []
        if not isin:
            warnings.append("ISIN_NOT_FOUND")
        if isin and not events:
            warnings.append("REDEMPTION_PLAN_NOT_FOUND")
        title = next((row[0] for row in parser.rows if row and len(row[0]) > 8), None)
        spread = None
        spread_match = re.search(
            r"(?:yıllık\s+basit\s+ek\s+getiri|yıllık\s+ek\s+getiri|ek\s+getiri\s+oranı)"
            r"(?:\s*\(%\))?\s*[:\-]?\s*%?\s*(\d+(?:[.,]\d+)?)",
            visible_text,
            re.IGNORECASE,
        )
        if spread_match:
            spread = _rate(spread_match.group(1))
        return ParsedDisclosure(
            isin=isin,
            title=title,
            published_at=_published_at(visible_text),
            explicit_annual_simple_spread=spread,
            events=tuple(events),
            warnings=tuple(warnings),
        )
