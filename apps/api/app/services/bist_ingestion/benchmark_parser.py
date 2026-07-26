from __future__ import annotations

import csv
import io
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, localcontext
from typing import Literal

from app.services.bist_ingestion.types import Diagnostic


BenchmarkName = Literal["TLREF", "TLREFK"]


@dataclass
class BenchmarkObservationData:
    benchmark: BenchmarkName
    observation_date: date
    published_annual_rate_pct: Decimal | None = None
    index_value: Decimal | None = None
    next_business_day_gap: int | None = None
    period_return: Decimal | None = None
    rate_source_row: int | None = None
    index_source_row: int | None = None


@dataclass(frozen=True)
class BenchmarkValidationData:
    benchmark: BenchmarkName
    observation_date: date
    previous_observation_date: date
    next_observation_date: date
    expected_index_value: Decimal
    actual_index_value: Decimal
    absolute_error: Decimal
    tolerance: Decimal
    passed: bool


@dataclass
class BenchmarkDataset:
    benchmark: BenchmarkName
    observations: list[BenchmarkObservationData] = field(default_factory=list)
    validations: list[BenchmarkValidationData] = field(default_factory=list)
    diagnostics: list[Diagnostic] = field(default_factory=list)

    @property
    def quality_summary(self) -> dict[str, object]:
        dates = [item.observation_date for item in self.observations]
        return {
            "benchmark": self.benchmark,
            "observations": len(self.observations),
            "min_date": min(dates).isoformat() if dates else None,
            "max_date": max(dates).isoformat() if dates else None,
            "rate_records": sum(item.published_annual_rate_pct is not None for item in self.observations),
            "index_records": sum(item.index_value is not None for item in self.observations),
            "validations": len(self.validations),
            "failed_validations": sum(not item.passed for item in self.validations),
            "max_absolute_error": str(
                max((item.absolute_error for item in self.validations), default=Decimal("0"))
            ),
        }


class BenchmarkParser:
    VERSION = "benchmark-v2-1"
    DEFAULT_TOLERANCE = Decimal("0.00000002")

    def parse_history(
        self,
        benchmark: BenchmarkName,
        *,
        rate_archive: bytes,
        index_archive: bytes,
        tolerance: Decimal = DEFAULT_TOLERANCE,
    ) -> BenchmarkDataset:
        rate_content = self.extract_single_csv(rate_archive)
        index_content = self.extract_single_csv(index_archive)
        rates = self.parse_rate_csv(benchmark, rate_content)
        indexes = self.parse_index_csv(benchmark, index_content)
        dataset = self.merge(benchmark, rates, indexes)
        self.validate_index_series(dataset, tolerance=tolerance)
        return dataset

    def parse_daily(
        self,
        benchmark: BenchmarkName,
        *,
        rate_content: bytes,
        index_content: bytes,
    ) -> BenchmarkDataset:
        return self.merge(
            benchmark,
            self.parse_rate_csv(benchmark, rate_content),
            self.parse_index_csv(benchmark, index_content),
        )

    @staticmethod
    def extract_single_csv(archive: bytes) -> bytes:
        if not archive.startswith(b"PK"):
            raise ValueError("Expected ZIP archive")
        with zipfile.ZipFile(io.BytesIO(archive)) as zip_file:
            members = [
                info
                for info in zip_file.infolist()
                if not info.is_dir() and info.filename.casefold().endswith(".csv")
            ]
            if len(members) != 1:
                raise ValueError(f"Expected exactly one CSV in ZIP, received {len(members)}")
            member = members[0]
            if member.file_size > 20 * 1024 * 1024:
                raise ValueError("Historical CSV exceeds safe uncompressed size")
            return zip_file.read(member)

    def parse_rate_csv(
        self,
        benchmark: BenchmarkName,
        content: bytes,
    ) -> dict[date, tuple[Decimal, int]]:
        text = self._decode(content)
        parsed: dict[date, tuple[Decimal, int]] = {}
        for row_number, row in enumerate(csv.reader(io.StringIO(text), delimiter=";"), start=1):
            if len(row) < 6:
                continue
            observation_date = self._date(row[0])
            value = self._decimal(row[5])
            if observation_date is None or value is None:
                continue
            if value < 0 or value > Decimal("500"):
                raise ValueError(f"Invalid {benchmark} annual rate {value} at row {row_number}")
            if observation_date in parsed:
                raise ValueError(f"Duplicate {benchmark} rate date: {observation_date}")
            parsed[observation_date] = (value, row_number)
        if not parsed:
            raise ValueError(f"No {benchmark} rate records parsed")
        return parsed

    def parse_index_csv(
        self,
        benchmark: BenchmarkName,
        content: bytes,
    ) -> dict[date, tuple[Decimal, int]]:
        text = self._decode(content)
        parsed: dict[date, tuple[Decimal, int]] = {}
        rows = list(csv.reader(io.StringIO(text), delimiter=";"))
        date_index, value_index = self._index_columns(rows[:2])
        for row_number, row in enumerate(rows, start=1):
            if len(row) <= max(date_index, value_index):
                continue
            observation_date = self._date(row[date_index])
            value = self._decimal(row[value_index])
            if observation_date is None or value is None:
                continue
            if value <= 0:
                raise ValueError(f"Invalid {benchmark} index {value} at row {row_number}")
            if observation_date in parsed:
                raise ValueError(f"Duplicate {benchmark} index date: {observation_date}")
            parsed[observation_date] = (value, row_number)
        if not parsed:
            raise ValueError(f"No BIST {benchmark} index records parsed")
        return parsed

    @staticmethod
    def merge(
        benchmark: BenchmarkName,
        rates: dict[date, tuple[Decimal, int]],
        indexes: dict[date, tuple[Decimal, int]],
    ) -> BenchmarkDataset:
        observations: list[BenchmarkObservationData] = []
        for observation_date in sorted(set(rates) | set(indexes)):
            rate = rates.get(observation_date)
            index = indexes.get(observation_date)
            observations.append(
                BenchmarkObservationData(
                    benchmark=benchmark,
                    observation_date=observation_date,
                    published_annual_rate_pct=rate[0] if rate else None,
                    index_value=index[0] if index else None,
                    rate_source_row=rate[1] if rate else None,
                    index_source_row=index[1] if index else None,
                )
            )
        dataset = BenchmarkDataset(benchmark=benchmark, observations=observations)
        rate_only = sorted(set(rates) - set(indexes))
        index_only = sorted(set(indexes) - set(rates))
        if rate_only:
            dataset.diagnostics.append(
                Diagnostic(
                    code="BENCHMARK_RATE_WITHOUT_INDEX",
                    severity="INFO",
                    message=f"{len(rate_only)} rate dates have no index observation.",
                    context={"first_dates": [item.isoformat() for item in rate_only[:10]]},
                )
            )
        if index_only:
            dataset.diagnostics.append(
                Diagnostic(
                    code="BENCHMARK_INDEX_WITHOUT_RATE",
                    severity="INFO",
                    message=f"{len(index_only)} index dates have no rate observation.",
                    context={"first_dates": [item.isoformat() for item in index_only[:10]]},
                )
            )
        return dataset

    def validate_index_series(
        self,
        dataset: BenchmarkDataset,
        *,
        tolerance: Decimal = DEFAULT_TOLERANCE,
    ) -> None:
        with_index = [
            item
            for item in dataset.observations
            if item.index_value is not None
        ]
        for position in range(1, len(with_index) - 1):
            previous = with_index[position - 1]
            current = with_index[position]
            following = with_index[position + 1]
            if current.published_annual_rate_pct is None:
                dataset.diagnostics.append(
                    Diagnostic(
                        code="MISSING_RATE_FOR_INDEX_VALIDATION",
                        severity="ERROR",
                        message="Index observation cannot be reconstructed without same-day rate.",
                        raw_fragment=current.observation_date.isoformat(),
                    )
                )
                continue
            gap = (following.observation_date - current.observation_date).days
            if gap <= 0:
                raise ValueError("Benchmark dates must be strictly increasing")
            with localcontext() as context:
                context.prec = 34
                period_return = current.published_annual_rate_pct / Decimal("100") * Decimal(gap) / Decimal("365")
                expected = previous.index_value * (Decimal("1") + period_return)
                absolute_error = abs(
                    current.index_value / previous.index_value
                    - (Decimal("1") + period_return)
                )
            current.next_business_day_gap = gap
            current.period_return = period_return
            validation = BenchmarkValidationData(
                benchmark=dataset.benchmark,
                observation_date=current.observation_date,
                previous_observation_date=previous.observation_date,
                next_observation_date=following.observation_date,
                expected_index_value=expected,
                actual_index_value=current.index_value,
                absolute_error=absolute_error,
                tolerance=tolerance,
                passed=absolute_error <= tolerance,
            )
            dataset.validations.append(validation)
            if not validation.passed:
                dataset.diagnostics.append(
                    Diagnostic(
                        code="INDEX_RECONSTRUCTION_FAILED",
                        severity="ERROR",
                        message=(
                            f"{dataset.benchmark} index reconstruction exceeded tolerance "
                            f"({absolute_error} > {tolerance})."
                        ),
                        raw_fragment=current.observation_date.isoformat(),
                        context={"gap": gap, "expected": str(expected), "actual": str(current.index_value)},
                    )
                )

    @staticmethod
    def _decode(content: bytes) -> str:
        if content.startswith((b"\xff\xfe", b"\xfe\xff")):
            return content.decode("utf-16")
        try:
            return content.decode("utf-8-sig")
        except UnicodeDecodeError:
            return content.decode("latin-1")

    @staticmethod
    def _date(value: str) -> date | None:
        candidate = value.strip()
        for pattern in ("%d/%m/%Y", "%d.%m.%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(candidate, pattern).date()
            except ValueError:
                continue
        return None

    @staticmethod
    def _decimal(value: str) -> Decimal | None:
        candidate = value.strip().replace(",", ".")
        if not candidate:
            return None
        try:
            return Decimal(candidate)
        except InvalidOperation:
            return None

    @staticmethod
    def _index_columns(header_rows: list[list[str]]) -> tuple[int, int]:
        date_index = 0
        value_index = 6
        for row in header_rows:
            normalized = [item.strip().casefold() for item in row]
            for position, column in enumerate(normalized):
                if column in {"tarih", "date"} or column.startswith("tarih (") or column.startswith("tarih/"):
                    date_index = position
                if (
                    column in {"kapanis", "kapanış", "closing", "closing value"}
                    or "kapanış değeri" in column
                    or "closing value" in column
                ):
                    value_index = position
        return date_index, value_index
