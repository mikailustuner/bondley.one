from __future__ import annotations

import hashlib
import io
import json
import re
import zipfile
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bist_ingestion import (
    BenchmarkObservation,
    BenchmarkValidationResult,
    BistGroupCodeVersion,
    BistInstrumentClassificationVersion,
    ImportDiagnostic,
    ImportRun,
    Instrument,
    InstrumentConflict,
    InstrumentTermRule,
    InstrumentVersion,
    RawWorkbookRow,
    SourceFile,
    SourceNote,
)
from app.services.bist_ingestion.benchmark_parser import BenchmarkName, BenchmarkParser
from app.services.bist_ingestion.downloader import DownloadedArtifact, SafeBistDownloader
from app.services.bist_ingestion.tbliste_parser import TblisteParser


class QualityGateError(ValueError):
    pass


def resolve_tbliste_effective_date(
    filename_date: date | None,
    requested_business_date: date | None,
) -> tuple[date | None, str]:
    """Resolve the publishable snapshot date without crossing the BIST cutoff.

    BIST may expose an archive whose member filename contains the current
    calendar date before that day's list is considered ready.  The business
    calendar is authoritative in that interval: a filename date later than the
    requested business date is retained only as source metadata and the
    snapshot is published for the requested date.
    """

    if (
        filename_date is not None
        and requested_business_date is not None
        and filename_date > requested_business_date
    ):
        return requested_business_date, "CUTOFF_CAPPED_SOURCE_FILENAME"
    if filename_date is not None:
        return filename_date, "SOURCE_FILENAME"
    return requested_business_date, "INFERRED_BUSINESS_DATE"


class VerifiedBistImportService:
    """Database coordinator for immutable BIST source imports."""

    def __init__(
        self,
        db: AsyncSession,
        *,
        archive_root: str | Path,
        downloader: SafeBistDownloader | None = None,
    ):
        self.db = db
        self.downloader = downloader or SafeBistDownloader(archive_root)
        self.tbliste_parser = TblisteParser()
        self.benchmark_parser = BenchmarkParser()

    async def import_tbliste(
        self,
        url: str,
        *,
        requested_business_date: date | None = None,
    ) -> dict[str, Any]:
        artifact = await self.downloader.fetch(url, expected_kind="tbliste_zip")
        xls_bytes, xls_name = self._extract_single(artifact.content, ".xls")
        filename_date = self._date_from_filename(xls_name)
        effective_date, date_origin = resolve_tbliste_effective_date(
            filename_date,
            requested_business_date,
        )
        freshness_status = self._freshness_status(
            effective_date,
            requested_business_date,
        )
        source_file = await self._source_file(
            artifact,
            source_kind="TBLISTE",
            effective_date=effective_date,
            requested_business_date=requested_business_date,
            date_origin=date_origin,
            freshness_status=freshness_status,
        )
        existing = await self._published_run(source_file.id, self.tbliste_parser.VERSION)
        if existing is not None:
            return {
                "status": "already_published",
                "source_file_id": source_file.id,
                "import_run_id": existing.id,
                "sha256": artifact.sha256,
                "effective_date": (
                    effective_date.isoformat() if effective_date else None
                ),
                "requested_business_date": (
                    requested_business_date.isoformat()
                    if requested_business_date
                    else None
                ),
                "date_origin": date_origin,
                "source_filename_date": (
                    filename_date.isoformat() if filename_date else None
                ),
                "freshness_status": freshness_status,
            }

        run = ImportRun(
            source_file_id=source_file.id,
            parser_name="TblisteParser",
            parser_version=self.tbliste_parser.VERSION,
            status="ARCHIVE_VALIDATED",
        )
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)

        try:
            parsed = self.tbliste_parser.parse(xls_bytes, filename=xls_name)
            run.status = "PARSED"
            run.row_count = len(parsed.raw_rows)
            run.instrument_count = len(parsed.instruments)
            run.warning_count = sum(item.severity == "WARNING" for item in parsed.diagnostics)
            run.error_count = sum(item.severity in {"ERROR", "FATAL"} for item in parsed.diagnostics)
            run.quarantine_count = len(
                [item for item in parsed.instruments if not item.valuation_eligible]
            )
            run.quality_report = parsed.quality_summary

            await self._persist_raw_rows(run, source_file, parsed)
            await self._persist_diagnostics(run, parsed.diagnostics)
            self._tbliste_quality_gate(parsed)
            run.status = "STAGED"
            await self._persist_tbliste_snapshot(source_file, parsed, effective_date)
            run.status = "PUBLISHED"
            run.finished_at = datetime.now(timezone.utc)
            source_file.status = "PUBLISHED"
            await self.db.commit()
            return {
                "status": "published",
                "source_file_id": source_file.id,
                "import_run_id": run.id,
                "sha256": artifact.sha256,
                "effective_date": effective_date.isoformat() if effective_date else None,
                "requested_business_date": (
                    requested_business_date.isoformat()
                    if requested_business_date
                    else None
                ),
                "date_origin": date_origin,
                "source_filename_date": (
                    filename_date.isoformat() if filename_date else None
                ),
                "freshness_status": freshness_status,
                "quality": parsed.quality_summary,
            }
        except Exception as exc:
            await self.db.rollback()
            failed = await self.db.get(ImportRun, run.id)
            if failed is not None:
                failed.status = (
                    "QUALITY_GATE_FAILED" if isinstance(exc, QualityGateError) else "PARSE_FAILED"
                )
                failed.failure_message = str(exc)
                failed.finished_at = datetime.now(timezone.utc)
                await self.db.commit()
            raise

    async def import_benchmark_pair(
        self,
        benchmark: BenchmarkName,
        *,
        rate_url: str,
        index_url: str,
        historical: bool,
        requested_business_date: date | None = None,
    ) -> dict[str, Any]:
        expected_kind = "benchmark_zip" if historical else "csv"
        rate_artifact = await self.downloader.fetch(rate_url, expected_kind=expected_kind)
        index_artifact = await self.downloader.fetch(index_url, expected_kind=expected_kind)
        if historical:
            dataset = self.benchmark_parser.parse_history(
                benchmark,
                rate_archive=rate_artifact.content,
                index_archive=index_artifact.content,
            )
        else:
            dataset = self.benchmark_parser.parse_daily(
                benchmark,
                rate_content=rate_artifact.content,
                index_content=index_artifact.content,
            )
        effective_date = max(item.observation_date for item in dataset.observations)
        freshness_status = (
            "HISTORICAL"
            if historical
            else self._freshness_status(effective_date, requested_business_date)
        )
        if freshness_status == "FUTURE":
            raise QualityGateError(
                f"{benchmark} source date {effective_date} is after expected business "
                f"date {requested_business_date}"
            )
        suffix = "HISTORICAL" if historical else "DAILY"
        rate_source = await self._source_file(
            rate_artifact,
            source_kind=f"{benchmark}_RATE_{suffix}",
            effective_date=effective_date,
            requested_business_date=requested_business_date,
            date_origin="SOURCE_CONTENT",
            freshness_status=freshness_status,
        )
        index_source = await self._source_file(
            index_artifact,
            source_kind=f"{benchmark}_INDEX_{suffix}",
            effective_date=effective_date,
            requested_business_date=requested_business_date,
            date_origin="SOURCE_CONTENT",
            freshness_status=freshness_status,
        )
        parser_version = self.benchmark_parser.VERSION
        existing = await self._published_run(rate_source.id, parser_version)
        if existing is not None:
            return {
                "status": "already_published",
                "benchmark": benchmark,
                "import_run_id": existing.id,
                "rate_source_file_id": rate_source.id,
                "index_source_file_id": index_source.id,
                "effective_date": effective_date.isoformat(),
                "freshness_status": freshness_status,
                "quality": dataset.quality_summary,
            }

        run = ImportRun(
            source_file_id=rate_source.id,
            parser_name="BenchmarkParser",
            parser_version=parser_version,
            status="PARSED",
            row_count=len(dataset.observations),
            quality_report={
                **dataset.quality_summary,
                "rate_source_file_id": rate_source.id,
                "index_source_file_id": index_source.id,
            },
            warning_count=sum(item.severity == "WARNING" for item in dataset.diagnostics),
            error_count=sum(item.severity in {"ERROR", "FATAL"} for item in dataset.diagnostics),
        )
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)
        try:
            await self._persist_diagnostics(run, dataset.diagnostics)
            failed = [item for item in dataset.validations if not item.passed]
            if historical and failed:
                raise QualityGateError(
                    f"{benchmark} index reconstruction failed for {len(failed)} observations"
                )
            run.status = "STAGED"
            await self._persist_benchmark_dataset(
                dataset,
                rate_source_id=rate_source.id,
                index_source_id=index_source.id,
            )
            run.status = "PUBLISHED"
            run.finished_at = datetime.now(timezone.utc)
            rate_source.status = "PUBLISHED"
            index_source.status = "PUBLISHED"
            await self.db.commit()
            return {
                "status": "published",
                "benchmark": benchmark,
                "import_run_id": run.id,
                "rate_source_file_id": rate_source.id,
                "index_source_file_id": index_source.id,
                "effective_date": effective_date.isoformat(),
                "requested_business_date": (
                    requested_business_date.isoformat()
                    if requested_business_date
                    else None
                ),
                "freshness_status": freshness_status,
                "quality": dataset.quality_summary,
            }
        except Exception as exc:
            await self.db.rollback()
            failed_run = await self.db.get(ImportRun, run.id)
            if failed_run is not None:
                failed_run.status = (
                    "QUALITY_GATE_FAILED" if isinstance(exc, QualityGateError) else "PARSE_FAILED"
                )
                failed_run.failure_message = str(exc)
                failed_run.finished_at = datetime.now(timezone.utc)
                await self.db.commit()
            raise

    async def _source_file(
        self,
        artifact: DownloadedArtifact,
        *,
        source_kind: str,
        effective_date: date | None,
        requested_business_date: date | None,
        date_origin: str,
        freshness_status: str,
    ) -> SourceFile:
        result = await self.db.execute(
            select(SourceFile).where(
                SourceFile.source_kind == source_kind,
                SourceFile.effective_date == effective_date,
                SourceFile.sha256 == artifact.sha256,
            )
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            return existing
        source = SourceFile(
            source_kind=source_kind,
            source_url=artifact.source_url,
            effective_date=effective_date,
            requested_business_date=requested_business_date,
            date_origin=date_origin,
            freshness_status=freshness_status,
            downloaded_at=artifact.downloaded_at,
            filename=artifact.filename,
            content_type=artifact.content_type,
            byte_size=artifact.byte_size,
            sha256=artifact.sha256,
            etag=artifact.etag,
            last_modified=artifact.last_modified,
            storage_key=artifact.storage_key,
            status="DOWNLOADED",
        )
        self.db.add(source)
        await self.db.commit()
        await self.db.refresh(source)
        return source

    async def _published_run(self, source_file_id: int, parser_version: str) -> ImportRun | None:
        result = await self.db.execute(
            select(ImportRun).where(
                ImportRun.source_file_id == source_file_id,
                ImportRun.parser_version == parser_version,
                ImportRun.status == "PUBLISHED",
            )
        )
        return result.scalar_one_or_none()

    async def _persist_raw_rows(self, run: ImportRun, source_file: SourceFile, parsed: Any) -> None:
        rows: list[RawWorkbookRow] = []
        for raw in parsed.raw_rows:
            row = RawWorkbookRow(
                import_run_id=run.id,
                sheet_name=raw.sheet_name,
                row_number=raw.row_number,
                row_class=raw.row_class,
                cells_json=[cell.to_dict() for cell in raw.cells],
                row_hash=raw.row_hash,
            )
            self.db.add(row)
            rows.append(row)
        await self.db.flush()
        by_location = {(item.sheet_name, item.row_number): item for item in rows}
        for note in parsed.source_notes:
            raw = by_location[(note["sheet_name"], note["row_number"])]
            self.db.add(
                SourceNote(
                    source_file_id=source_file.id,
                    raw_row_id=raw.id,
                    sheet_name=note["sheet_name"],
                    row_number=note["row_number"],
                    note_kind="SOURCE_NOTE",
                    note_text=note["text"],
                )
            )

    async def _persist_diagnostics(self, run: ImportRun, diagnostics: list[Any]) -> None:
        for item in diagnostics:
            self.db.add(
                ImportDiagnostic(
                    import_run_id=run.id,
                    severity=item.severity,
                    code=item.code,
                    message=item.message,
                    sheet_name=item.sheet_name,
                    row_number=item.row_number,
                    column_number=item.column_number,
                    raw_fragment=item.raw_fragment,
                    context_json=item.context or None,
                )
            )

    @staticmethod
    def _tbliste_quality_gate(parsed: Any) -> None:
        if len(parsed.instruments) < 1000:
            raise QualityGateError(
                f"Instrument count below safety floor: {len(parsed.instruments)}"
            )
        if len(parsed.group_codes) < 20 or len(parsed.classifications) < 10:
            raise QualityGateError("Reference sheet was not parsed completely")
        fatal = [item for item in parsed.diagnostics if item.severity == "FATAL"]
        header_errors = [item for item in parsed.diagnostics if item.code == "HEADER_MISMATCH"]
        if fatal or header_errors:
            raise QualityGateError("Fatal schema diagnostics prevent publication")

    async def _persist_tbliste_snapshot(
        self,
        source_file: SourceFile,
        parsed: Any,
        effective_date: date | None,
    ) -> None:
        run_result = await self.db.execute(
            select(ImportRun)
            .where(ImportRun.source_file_id == source_file.id)
            .order_by(ImportRun.id.desc())
            .limit(1)
        )
        run = run_result.scalar_one()
        raw_result = await self.db.execute(
            select(RawWorkbookRow).where(RawWorkbookRow.import_run_id == run.id)
        )
        raw_by_location = {
            (item.sheet_name, item.row_number): item for item in raw_result.scalars().all()
        }

        for reference in parsed.group_codes:
            self.db.add(
                BistGroupCodeVersion(
                    source_file_id=source_file.id,
                    group_code=reference.code,
                    description_tr=reference.description_tr,
                    description_en=reference.description_en,
                    source_row_number=reference.row_number,
                    effective_date=effective_date,
                )
            )
        for reference in parsed.classifications:
            self.db.add(
                BistInstrumentClassificationVersion(
                    source_file_id=source_file.id,
                    classification_code=reference.code,
                    description_tr=reference.description_tr,
                    description_en=reference.description_en,
                    source_row_number=reference.row_number,
                    effective_date=effective_date,
                )
            )

        isins = sorted(parsed.unique_isins)
        existing_result = await self.db.execute(select(Instrument).where(Instrument.isin.in_(isins)))
        instruments = {item.isin: item for item in existing_result.scalars().all()}
        for parsed_instrument in parsed.instruments:
            if parsed_instrument.isin not in instruments:
                model = Instrument(
                    isin=parsed_instrument.isin,
                    instrument_family=parsed_instrument.fields["instrument_family"],
                )
                self.db.add(model)
                instruments[parsed_instrument.isin] = model
        await self.db.flush()

        if effective_date is not None:
            latest_effective_date = await self.db.scalar(
                select(InstrumentVersion.valid_from)
                .where(
                    InstrumentVersion.is_published.is_(True),
                    InstrumentVersion.valid_from.is_not(None),
                )
                .order_by(InstrumentVersion.valid_from.desc())
                .limit(1)
            )
            if (
                latest_effective_date is not None
                and effective_date < latest_effective_date
            ):
                raise QualityGateError(
                    f"Refusing to publish older tbliste snapshot {effective_date}; "
                    f"current snapshot is {latest_effective_date}"
                )
            await self.db.execute(
                update(InstrumentVersion)
                .where(
                    InstrumentVersion.is_published.is_(True),
                    InstrumentVersion.valid_to.is_(None),
                )
                .values(valid_to=effective_date, is_published=False)
            )

        for parsed_instrument in parsed.instruments:
            fields = parsed_instrument.fields
            raw = raw_by_location[(parsed_instrument.raw_row.sheet_name, parsed_instrument.row_number)]
            fingerprint_payload = json.dumps(
                {
                    "fields": fields,
                    "term_rule": parsed_instrument.term_rule,
                },
                ensure_ascii=False,
                sort_keys=True,
            ).encode("utf-8")
            version = InstrumentVersion(
                instrument_id=instruments[parsed_instrument.isin].id,
                source_file_id=source_file.id,
                raw_row_id=raw.id,
                source_row_number=parsed_instrument.row_number,
                valid_from=effective_date,
                is_published=True,
                parse_status=parsed_instrument.parse_status,
                valuation_eligible=parsed_instrument.valuation_eligible,
                issuer_name=fields.get("issuer_name"),
                maturity_date=self._optional_date(fields.get("maturity_date")),
                yield_type_raw=fields.get("yield_type_raw"),
                security_type_raw=fields.get("security_type_raw"),
                group_code=fields.get("group_code"),
                bist_security_type_code=fields.get("bist_security_type_code"),
                canonical_fields_json=fields,
                semantic_fingerprint=hashlib.sha256(fingerprint_payload).hexdigest(),
            )
            self.db.add(version)
            await self.db.flush()
            self.db.add(
                InstrumentTermRule(
                    instrument_version_id=version.id,
                    parser_version=parsed_instrument.term_rule["parser_version"],
                    ast_schema_version=parsed_instrument.term_rule["schema_version"],
                    status=parsed_instrument.parse_status,
                    remarks_raw=fields.get("remarks_raw"),
                    remarks_normalized=parsed_instrument.term_rule.get("normalized_text"),
                    ast_json=parsed_instrument.term_rule,
                )
            )

        for conflict in parsed.conflicts:
            self.db.add(
                InstrumentConflict(
                    source_file_id=source_file.id,
                    isin=conflict.isin,
                    conflict_type=conflict.conflict_type,
                    source_row_numbers_json=conflict.row_numbers,
                    differences_json=conflict.differences,
                )
            )

    async def _persist_benchmark_dataset(
        self,
        dataset: Any,
        *,
        rate_source_id: int,
        index_source_id: int,
    ) -> None:
        records = []
        for item in dataset.observations:
            records.append(
                {
                    "benchmark": dataset.benchmark,
                    "observation_date": item.observation_date,
                    "published_annual_rate_pct": item.published_annual_rate_pct,
                    "annual_rate_decimal": (
                        item.published_annual_rate_pct / Decimal("100")
                        if item.published_annual_rate_pct is not None
                        else None
                    ),
                    "index_value": item.index_value,
                    "next_business_day_gap": item.next_business_day_gap,
                    "period_return": item.period_return,
                    "rate_source_file_id": rate_source_id if item.rate_source_row else None,
                    "index_source_file_id": index_source_id if item.index_source_row else None,
                    "rate_source_row": item.rate_source_row,
                    "index_source_row": item.index_source_row,
                }
            )
        for start in range(0, len(records), 500):
            statement = pg_insert(BenchmarkObservation).values(records[start : start + 500])
            statement = statement.on_conflict_do_update(
                constraint="uq_benchmark_observation",
                set_={
                    "published_annual_rate_pct": statement.excluded.published_annual_rate_pct,
                    "annual_rate_decimal": statement.excluded.annual_rate_decimal,
                    "index_value": statement.excluded.index_value,
                    "next_business_day_gap": statement.excluded.next_business_day_gap,
                    "period_return": statement.excluded.period_return,
                    "rate_source_file_id": statement.excluded.rate_source_file_id,
                    "index_source_file_id": statement.excluded.index_source_file_id,
                    "rate_source_row": statement.excluded.rate_source_row,
                    "index_source_row": statement.excluded.index_source_row,
                    "updated_at": datetime.now(timezone.utc),
                },
            )
            await self.db.execute(statement)

        validations = [
            {
                "benchmark": item.benchmark,
                "observation_date": item.observation_date,
                "previous_observation_date": item.previous_observation_date,
                "next_observation_date": item.next_observation_date,
                "expected_index_value": item.expected_index_value,
                "actual_index_value": item.actual_index_value,
                "absolute_error": item.absolute_error,
                "tolerance": item.tolerance,
                "passed": item.passed,
                "rate_source_file_id": rate_source_id,
                "index_source_file_id": index_source_id,
            }
            for item in dataset.validations
        ]
        for start in range(0, len(validations), 500):
            statement = pg_insert(BenchmarkValidationResult).values(
                validations[start : start + 500]
            )
            statement = statement.on_conflict_do_nothing(
                constraint="uq_benchmark_validation_source"
            )
            await self.db.execute(statement)

    @staticmethod
    def _extract_single(archive: bytes, suffix: str) -> tuple[bytes, str]:
        with zipfile.ZipFile(io.BytesIO(archive)) as zip_file:
            members = [
                info
                for info in zip_file.infolist()
                if not info.is_dir() and info.filename.casefold().endswith(suffix)
            ]
            if len(members) != 1:
                raise ValueError(f"Expected exactly one {suffix} file, received {len(members)}")
            info = members[0]
            if info.file_size > 20 * 1024 * 1024:
                raise ValueError("Extracted file exceeds safe limit")
            return zip_file.read(info), Path(info.filename).name

    @staticmethod
    def _date_from_filename(filename: str) -> date | None:
        match = re.search(r"(\d{8})", filename)
        if not match:
            return None
        return datetime.strptime(match.group(1), "%Y%m%d").date()

    @staticmethod
    def _freshness_status(
        effective_date: date | None,
        requested_business_date: date | None,
    ) -> str:
        if effective_date is None or requested_business_date is None:
            return "UNKNOWN"
        if effective_date == requested_business_date:
            return "CURRENT"
        if effective_date < requested_business_date:
            return "STALE"
        return "FUTURE"

    @staticmethod
    def _optional_date(value: str | None) -> date | None:
        return date.fromisoformat(value) if value else None
