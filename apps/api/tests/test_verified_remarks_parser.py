import json
from pathlib import Path

from app.services.bist_ingestion.remarks_parser import RemarksParser


FIXTURE = Path(__file__).parent / "fixtures" / "bist" / "remarks-golden.json"


def test_remarks_golden_cases():
    parser = RemarksParser()
    cases = json.loads(FIXTURE.read_text(encoding="utf-8"))
    for case in cases:
        result = parser.parse(
            case["remarks"],
            isin=case["isin"],
            spread_raw=case["spread"],
            yield_type=case["yield_type"],
        )
        assert result.status == case["status"], case["name"]
        assert case["benchmark"] in [item["name"] for item in result.ast["benchmarks"]], case["name"]
        if "spread_decimal" in case:
            assert case["spread_decimal"] in [
                item["decimal"] for item in result.ast["spreads"]
            ], case["name"]
        if "diagnostic" in case:
            assert case["diagnostic"] in [item.code for item in result.diagnostics], case["name"]
        if "comparison" in case:
            assert result.ast["comparison"] == case["comparison"], case["name"]
        if "lag" in case:
            assert case["lag"] in [
                item["lag_business_days"] for item in result.ast["observation_lags"]
            ], case["name"]
        if "annuality" in case:
            assert result.ast["spread_annuality"] == case["annuality"], case["name"]
        if "rounding" in case:
            assert result.ast["rounding"]["decimal_places"] == case["rounding"], case["name"]


def test_raw_remarks_are_never_rewritten():
    raw = "  TLREFK\u00a0+\u00a0%0,25  "
    result = RemarksParser().parse(raw, isin="TRDTEST00045", yield_type="Değişken")
    assert result.raw_text == raw
    assert result.normalized_text == "TLREFK + %0,25"


def test_source_decimal_spread_is_not_rescaled():
    result = RemarksParser().parse(
        "",
        isin="TRTEST000044",
        spread_raw="0.0425",
        yield_type="Değişken TLREF",
    )
    candidate = next(item for item in result.ast["spreads"] if item["source"] == "SPREAD_COLUMN")
    assert candidate["decimal"] == "0.0425"
    assert candidate["equivalent_bps"] == 425
