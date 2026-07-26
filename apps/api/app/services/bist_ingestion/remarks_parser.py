from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from app.services.bist_ingestion.types import Diagnostic, ParseStatus


NUMBER = r"\d+(?:[.,]\d+)?"


@dataclass(frozen=True)
class RemarksParseResult:
    raw_text: str
    normalized_text: str
    ast: dict[str, Any]
    status: ParseStatus
    diagnostics: list[Diagnostic]


def _normalized(value: object) -> str:
    text = unicodedata.normalize("NFC", str(value or ""))
    text = text.replace("\u00a0", " ")
    return re.sub(r"\s+", " ", text).strip()


def _decimal(raw: str) -> Decimal | None:
    try:
        return Decimal(raw.replace(",", "."))
    except InvalidOperation:
        return None


def _decimal_string(value: Decimal) -> str:
    return format(value.normalize(), "f")


class RemarksParser:
    """Conservative Turkish fixed-income remarks parser.

    The parser extracts only explicit semantics. It never rescales a bare number merely
    because another scale appears economically more plausible.
    """

    VERSION = "remarks-tr-v1"

    _benchmark_patterns = (
        ("BIST_TLREFK_INDEX", re.compile(r"\bbist\s*tlrefk\s*(?:endeks(?:i)?)?", re.I)),
        ("TLREFK_RATE", re.compile(r"\btlrefk\b", re.I)),
        ("BIST_TLREF_INDEX", re.compile(r"\bbist\s*tlref\s*(?:endeks(?:i)?)?", re.I)),
        ("TLREF_RATE", re.compile(r"\btlref\b", re.I)),
        ("TRLIBOR_3M", re.compile(r"\b3\s*m(?:onth)?\s*trlibor\b|\b3\s*ay(?:lık)?\s*trlibor\b", re.I)),
        ("TRLIBOR", re.compile(r"\btrlibor\b", re.I)),
        ("UST", re.compile(r"\bust\b|abd\s+hazine", re.I)),
        ("MS", re.compile(r"\bms\s*\+", re.I)),
        ("GOVERNMENT_AUCTION", re.compile(r"\bd[iİıI]bs\b|devlet\s+tahvili|ihale", re.I)),
        ("CPI_REFERENCE_INDEX", re.compile(r"\bt[üu]fe\b|enflasyon|referans\s+endeks", re.I)),
    )

    def parse(
        self,
        remarks: object,
        *,
        isin: str | None = None,
        spread_raw: object = None,
        yield_type: object = None,
    ) -> RemarksParseResult:
        raw = str(remarks or "")
        text = _normalized(raw)
        spread_text = _normalized(spread_raw)
        yield_text = _normalized(yield_type)
        combined = " ".join(part for part in (yield_text, spread_text, text) if part)
        diagnostics: list[Diagnostic] = []

        instrument_family = "PARTICIPATION" if (isin or "").upper().startswith("TRD") else "STANDARD"
        benchmarks = self._benchmarks(combined)
        explicit_tlref = any(item["name"] in {"TLREF_RATE", "BIST_TLREF_INDEX"} for item in benchmarks)
        explicit_tlrefk = any(item["name"] in {"TLREFK_RATE", "BIST_TLREFK_INDEX"} for item in benchmarks)
        variable_terms = bool(re.search(r"değişken|degisken|variable|endeks|indexed|tlref", combined, re.I))

        if instrument_family == "PARTICIPATION" and explicit_tlref and not explicit_tlrefk:
            diagnostics.append(
                Diagnostic(
                    code="TRD_EXPECTED_TLREFK_CONFLICT",
                    severity="ERROR",
                    message="TRD ailesindeki değişken kıymette açık TLREF bulundu; TLREFK bekleniyor.",
                    raw_fragment=combined,
                )
            )
        elif instrument_family == "PARTICIPATION" and variable_terms and not benchmarks:
            benchmarks.append(
                {
                    "name": "TLREFK_RATE",
                    "source": "ISIN_PREFIX",
                    "confidence": "INFERRED",
                }
            )
            diagnostics.append(
                Diagnostic(
                    code="TRD_TLREFK_INFERRED",
                    severity="INFO",
                    message="TRD değişken kıymeti için beklenen benchmark TLREFK olarak işaretlendi.",
                )
            )

        spread_candidates = self._spread_candidates(spread_text, text)
        for candidate in spread_candidates:
            if candidate["unit"] == "UNKNOWN":
                diagnostics.append(
                    Diagnostic(
                        code="AMBIGUOUS_SPREAD_UNIT",
                        message="Ek getiri sayısı bulundu ancak yüzde/baz puan birimi açık değil.",
                        raw_fragment=candidate["source_text"],
                    )
                )
            canonical = candidate.get("decimal")
            if canonical is not None and abs(Decimal(canonical)) > Decimal("0.25"):
                diagnostics.append(
                    Diagnostic(
                        code="OUTLIER_SPREAD",
                        message="Açık birimli spread %25 üzerinde; kaynak değer değiştirilmeden saklandı.",
                        raw_fragment=candidate["source_text"],
                    )
                )

        lags = self._observation_lags(text)
        annuality = self._annuality(text)
        regimes = self._coupon_regimes(text)
        comparison = "MAX" if re.search(r"yüksek\s+olan|hangisi\s+yüksek", text, re.I) else None
        rounding = self._rounding(text)
        benchmark_mode = self._benchmark_mode(text)

        for bad_date in re.findall(r"\b\d{1,2}[./]\d{1,2}[./]\d{4}\b", text):
            day, month, _year = (int(part) for part in re.split(r"[./]", bad_date))
            if day > 31 or month > 12:
                diagnostics.append(
                    Diagnostic(
                        code="INVALID_DATE",
                        severity="ERROR",
                        message="Açıklamada geçersiz tarih bulundu.",
                        raw_fragment=bad_date,
                    )
                )

        formula_like = bool(re.search(r"[=×*/()]|\bformül\b|\bformula\b", text, re.I))
        ast: dict[str, Any] = {
            "schema_version": "coupon-rule-ast-v1",
            "parser_version": self.VERSION,
            "normalized_text": text,
            "instrument_family": instrument_family,
            "benchmarks": benchmarks,
            "benchmark_mode": benchmark_mode,
            "spreads": spread_candidates,
            "spread_annuality": annuality,
            "observation_lags": lags,
            "coupon_regimes": regimes,
            "comparison": comparison,
            "rounding": rounding,
            "formula_like": formula_like,
            "raw_spread_cell": spread_text or None,
        }

        if any(item.severity in {"ERROR", "FATAL"} for item in diagnostics):
            status: ParseStatus = "CONFLICTING"
        elif any(item.code == "AMBIGUOUS_SPREAD_UNIT" for item in diagnostics):
            status = "AMBIGUOUS"
        elif formula_like or regimes or rounding:
            status = "PARTIAL"
        else:
            status = "EXACT"

        ast["status"] = status
        ast["diagnostics"] = [item.to_dict() for item in diagnostics]
        return RemarksParseResult(raw, text, ast, status, diagnostics)

    def _benchmarks(self, text: str) -> list[dict[str, str]]:
        found: list[dict[str, str]] = []
        occupied: list[tuple[int, int]] = []
        for name, pattern in self._benchmark_patterns:
            for match in pattern.finditer(text):
                if any(match.start() < end and match.end() > start for start, end in occupied):
                    continue
                occupied.append(match.span())
                found.append(
                    {
                        "name": name,
                        "source": "EXPLICIT_TEXT",
                        "confidence": "EXACT",
                        "source_text": match.group(0),
                    }
                )
        return found

    def _spread_candidates(self, spread_cell: str, remarks: str) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()
        sources = [("SPREAD_COLUMN", spread_cell), ("REMARKS", remarks)]

        patterns = (
            (
                re.compile(
                    rf"(?:tlrefk?|trlibor|endeks(?:i|\s+değişimi)?|ek\s+getiri|ilave\s+getiri)"
                    rf"[^.;]{{0,35}}?\+\s*%\s*(?P<n>{NUMBER})",
                    re.I,
                ),
                "PERCENT",
            ),
            (
                re.compile(
                    rf"(?:tlrefk?|trlibor|endeks(?:i|\s+değişimi)?|ek\s+getiri|ilave\s+getiri)"
                    rf"[^.;]{{0,35}}?\+\s*(?P<n>{NUMBER})\s*(?:baz\s*puan|bps?|bbs?)",
                    re.I,
                ),
                "BASIS_POINTS",
            ),
            (re.compile(rf"(?P<n>{NUMBER})\s*(?:baz\s*puan|bps?|bbs?)", re.I), "BASIS_POINTS"),
            (
                re.compile(rf"(?:ek|ilave)\s+getiri[^.;]{{0,25}}?%\s*(?P<n>{NUMBER})", re.I),
                "PERCENT",
            ),
            (
                re.compile(rf"(?:tlrefk?|trlibor)\s*\+\s*(?P<n>{NUMBER})(?!\s*[%a-zA-Z])", re.I),
                "UNKNOWN",
            ),
        )

        if spread_cell:
            numeric = re.fullmatch(rf"\s*(?P<n>{NUMBER})\s*", spread_cell)
            if numeric:
                self._append_spread(candidates, seen, numeric.group("n"), "SOURCE_DECIMAL", spread_cell, "SPREAD_COLUMN")

        for source_name, source_text in sources:
            if not source_text:
                continue
            for pattern, unit in patterns:
                for match in pattern.finditer(source_text):
                    self._append_spread(
                        candidates,
                        seen,
                        match.group("n"),
                        unit,
                        match.group(0),
                        source_name,
                    )
        return candidates

    @staticmethod
    def _append_spread(
        candidates: list[dict[str, Any]],
        seen: set[tuple[str, str]],
        number: str,
        unit: str,
        source_text: str,
        source: str,
    ) -> None:
        key = (number.replace(",", "."), unit)
        if key in seen:
            return
        seen.add(key)
        value = _decimal(number)
        if value is None:
            return
        canonical: Decimal | None
        if unit == "PERCENT":
            canonical = value / Decimal("100")
        elif unit == "BASIS_POINTS":
            canonical = value / Decimal("10000")
        elif unit == "SOURCE_DECIMAL":
            canonical = value
        else:
            canonical = None
        candidates.append(
            {
                "value_raw": number,
                "unit": unit,
                "decimal": _decimal_string(canonical) if canonical is not None else None,
                "equivalent_bps": int(canonical * Decimal("10000")) if canonical is not None else None,
                "source": source,
                "source_text": source_text,
            }
        )

    @staticmethod
    def _annuality(text: str) -> str:
        if re.search(r"dönemsel\s+(?:ek|ilave)?\s*getiri|periyodik\s+(?:ek|ilave)?\s*getiri", text, re.I):
            return "PERIODIC"
        if re.search(r"yıllık\s+basit|yillik\s+basit|ek\s+getiri\s+yıllık|ek\s+getiri\s+yillik", text, re.I):
            return "ANNUAL_SIMPLE"
        return "UNKNOWN"

    @staticmethod
    def _benchmark_mode(text: str) -> str | None:
        if re.search(r"endeks(?:i|inin)?\s*(?:değiş|degis)|endeks\s+değişimi", text, re.I):
            return "INDEX_CHANGE"
        if re.search(r"bileşik|bilesik|compound|\b∏\b", text, re.I):
            return "COMPOUNDED_OVERNIGHT"
        if re.search(r"aritmetik|ortalama", text, re.I):
            return "ARITHMETIC_OVERNIGHT"
        return None

    @staticmethod
    def _observation_lags(text: str) -> list[dict[str, Any]]:
        lags: list[dict[str, Any]] = []
        patterns = (
            (2, re.compile(r"2\s*iş\s*günü\s*önce|iki\s*iş\s*günü\s*önce", re.I)),
            (1, re.compile(r"(?:1|bir)\s*iş\s*günü\s*önce|önceki\s*iş\s*günü", re.I)),
        )
        for days, pattern in patterns:
            for match in pattern.finditer(text):
                lags.append(
                    {
                        "lag_business_days": days,
                        "source_text": match.group(0),
                    }
                )
        return lags

    @staticmethod
    def _coupon_regimes(text: str) -> list[dict[str, str]]:
        regimes: list[dict[str, str]] = []
        if re.search(r"ilk\s+kupon|birinci\s+kupon", text, re.I):
            regimes.append({"applies_to": "FIRST", "source": "EXPLICIT_TEXT"})
        if re.search(r"diğer\s+kupon|sonraki\s+kupon", text, re.I):
            regimes.append({"applies_to": "SUBSEQUENT", "source": "EXPLICIT_TEXT"})
        return regimes

    @staticmethod
    def _rounding(text: str) -> dict[str, Any] | None:
        match = re.search(
            r"virgülden\s+sonra\s+(?P<n>\d+|iki|üç|dört)\s+hane[^.]*yuvarlan",
            text,
            re.I,
        )
        if not match:
            return None
        value = match.group("n").lower()
        digits = {"iki": 2, "üç": 3, "dört": 4}.get(value, int(value) if value.isdigit() else None)
        return {"decimal_places": digits, "mode": "SOURCE_SPECIFIED", "source_text": match.group(0)}
