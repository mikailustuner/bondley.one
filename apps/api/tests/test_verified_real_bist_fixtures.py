import hashlib
import json
import os
from pathlib import Path

import pytest

from app.services.bist_ingestion.benchmark_parser import BenchmarkParser
from app.services.bist_ingestion.tbliste_parser import TblisteParser


MANIFEST_PATH = Path(__file__).parent / "fixtures" / "bist" / "manifest.json"


def _fixture_root() -> Path:
    raw = os.getenv("BIST_AUDIT_FIXTURE_DIR")
    if not raw:
        pytest.skip("Set BIST_AUDIT_FIXTURE_DIR to run official full-file verification")
    root = Path(raw)
    if not root.exists():
        pytest.skip(f"BIST fixture directory does not exist: {root}")
    return root


def _assert_hash(path: Path, expected: str) -> None:
    assert hashlib.sha256(path.read_bytes()).hexdigest() == expected


def test_official_tbliste_full_profile():
    root = _fixture_root()
    manifest = json.loads(MANIFEST_PATH.read_text())
    zip_path = root / "tbliste.zip"
    xls_path = root / "extracted" / "tbliste_20260724.xls"
    _assert_hash(zip_path, manifest["sources"]["tbliste.zip"]["sha256"])
    result = TblisteParser().parse(xls_path.read_bytes(), filename=xls_path.name)
    expected = manifest["expected"]
    assert result.quality_summary["instrument_rows"] == expected["instrument_rows"]
    assert result.quality_summary["unique_isins"] == expected["unique_isins"]
    assert result.quality_summary["source_notes"] == expected["source_notes"]
    assert result.quality_summary["group_codes"] == expected["group_codes"]
    assert result.quality_summary["classifications"] == expected["classifications"]
    assert [item.isin for item in result.conflicts] == [expected["conflicting_duplicate_isin"]]
    assert not any(item.code == "INVALID_ISIN_CHECK_DIGIT" for item in result.diagnostics)


@pytest.mark.parametrize(
    ("benchmark", "rate_file", "index_file", "rate_key", "index_key", "validation_key"),
    [
        (
            "TLREF",
            "TLREFORANI_D.zip",
            "BISTTLREFENDEKSI_D.zip",
            "tlref_rate_records",
            "tlref_index_records",
            "tlref_validations",
        ),
        (
            "TLREFK",
            "TLREFKORANI_D.zip",
            "BISTTLREFKENDEKSI_D.zip",
            "tlrefk_rate_records",
            "tlrefk_index_records",
            "tlrefk_validations",
        ),
    ],
)
def test_official_benchmark_full_reconstruction(
    benchmark,
    rate_file,
    index_file,
    rate_key,
    index_key,
    validation_key,
):
    root = _fixture_root()
    manifest = json.loads(MANIFEST_PATH.read_text())
    _assert_hash(root / rate_file, manifest["sources"][rate_file]["sha256"])
    _assert_hash(root / index_file, manifest["sources"][index_file]["sha256"])
    dataset = BenchmarkParser().parse_history(
        benchmark,
        rate_archive=(root / rate_file).read_bytes(),
        index_archive=(root / index_file).read_bytes(),
    )
    expected = manifest["expected"]
    quality = dataset.quality_summary
    assert quality["rate_records"] == expected[rate_key]
    assert quality["index_records"] == expected[index_key]
    assert quality["validations"] == expected[validation_key]
    assert quality["failed_validations"] == 0
