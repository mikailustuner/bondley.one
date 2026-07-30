from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.instrument_status import (
    InstrumentStatus,
    is_instrument_active,
    matches_instrument_status,
)
from app.core.time import turkey_today
from app.models.bist_ingestion import (
    BenchmarkObservation,
    Instrument,
    InstrumentVersion,
    SourceFile,
)
from app.models.system_setting import SystemSetting


router = APIRouter()


def _date(value: object) -> date | None:
    try:
        return date.fromisoformat(str(value)) if value else None
    except ValueError:
        return None


def _public_payload(
    instrument: Instrument,
    version: InstrumentVersion,
    source: SourceFile,
) -> dict[str, object]:
    fields = version.canonical_fields_json
    is_active = is_instrument_active(
        version.maturity_date,
        current_date=turkey_today(),
    )
    return {
        "isin_code": instrument.isin,
        "issuer": version.issuer_name,
        "security_type": version.security_type_raw,
        "yield_type": version.yield_type_raw,
        "currency": fields.get("currency_or_unit") or "TRY",
        "maturity_date": (
            version.maturity_date.isoformat() if version.maturity_date else None
        ),
        "is_active": is_active,
        "coupon_frequency": fields.get("coupon_frequency_per_year"),
        "first_issue_date": fields.get("first_issue_date"),
        "total_issue_amount": fields.get("total_issue_amount_thousands"),
        "next_coupon_date": fields.get("next_coupon_date"),
        "updated_at": source.downloaded_at.isoformat(),
        "source_effective_date": (
            source.effective_date.isoformat() if source.effective_date else None
        ),
        "data_quality": version.parse_status,
    }


async def _published_rows(
    db: AsyncSession,
) -> list[tuple[Instrument, InstrumentVersion, SourceFile]]:
    rows = (
        await db.execute(
            select(Instrument, InstrumentVersion, SourceFile)
            .join(
                InstrumentVersion,
                InstrumentVersion.instrument_id == Instrument.id,
            )
            .join(SourceFile, SourceFile.id == InstrumentVersion.source_file_id)
            .where(InstrumentVersion.is_published.is_(True))
            .order_by(Instrument.isin, InstrumentVersion.id.desc())
        )
    ).all()
    unique: dict[int, tuple[Instrument, InstrumentVersion, SourceFile]] = {}
    for row in rows:
        unique.setdefault(row[0].id, row)
    return list(unique.values())


@router.get("/maintenance")
async def get_maintenance_status(db: AsyncSession = Depends(get_db)):
    setting = await db.scalar(
        select(SystemSetting).where(SystemSetting.key == "maintenance_mode")
    )
    return {"is_maintenance": bool(setting and setting.value == "true")}


@router.get("/public-summary")
async def get_public_summary(db: AsyncSession = Depends(get_db)):
    recent = (
        await db.execute(
            select(BenchmarkObservation)
            .where(BenchmarkObservation.benchmark == "TLREF")
            .order_by(BenchmarkObservation.observation_date.desc())
            .limit(2)
        )
    ).scalars().all()
    latest = recent[0] if recent else None
    previous = recent[1] if len(recent) > 1 else None
    rows = await _published_rows(db)
    today = turkey_today()
    active = [
        row
        for row in rows
        if row[1].maturity_date is None or row[1].maturity_date >= today
    ]
    max_coupon_date = today + timedelta(days=2)
    upcoming = []
    for instrument, version, _source in active:
        coupon_date = _date(version.canonical_fields_json.get("next_coupon_date"))
        if coupon_date and today <= coupon_date <= max_coupon_date:
            upcoming.append(
                {
                    "isin_code": instrument.isin,
                    "issuer": version.issuer_name,
                    "next_coupon_date": coupon_date.isoformat(),
                    "days_to_coupon": (coupon_date - today).days,
                }
            )
    upcoming.sort(key=lambda item: (item["next_coupon_date"], item["isin_code"]))

    index_change = None
    if (
        latest
        and previous
        and latest.index_value is not None
        and previous.index_value not in (None, Decimal("0"))
    ):
        index_change = float(
            (latest.index_value - previous.index_value)
            / previous.index_value
            * Decimal("100")
        )

    return {
        "tlref_index": float(latest.index_value) if latest and latest.index_value else None,
        "tlref_date": latest.observation_date.isoformat() if latest else None,
        "tlref_published_annual_rate_pct": (
            float(latest.published_annual_rate_pct)
            if latest and latest.published_annual_rate_pct is not None
            else None
        ),
        "tlref_index_change_pct": index_change,
        "total_tlref_records": (
            await db.scalar(
                select(func.count(BenchmarkObservation.id)).where(
                    BenchmarkObservation.benchmark == "TLREF"
                )
            )
            or 0
        ),
        "total_bonds": len(active),
        "upcoming_bonds": upcoming,
    }


@router.get("/public-bonds")
async def get_public_bonds(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=1000, ge=1, le=3000),
    instrument_status: InstrumentStatus = Query(default="active", alias="status"),
    search: str | None = Query(default=None, min_length=1, max_length=100),
):
    today = turkey_today()
    rows = await _published_rows(db)
    search_term = search.strip().casefold() if search else None
    selected_rows = [
        row
        for row in rows
        if matches_instrument_status(
            row[1].maturity_date,
            current_date=today,
            status=instrument_status,
        )
        and (
            search_term is None
            or search_term in row[0].isin.casefold()
            or search_term in (row[1].issuer_name or "").casefold()
        )
    ]
    if instrument_status == "matured":
        selected_rows.sort(
            key=lambda row: row[1].maturity_date or date.min,
            reverse=True,
        )
    payloads = [_public_payload(*row) for row in selected_rows]
    return payloads[:limit]


@router.get("/public-bonds/{isin}")
async def get_public_bond(isin: str, db: AsyncSession = Depends(get_db)):
    row = (
        await db.execute(
            select(Instrument, InstrumentVersion, SourceFile)
            .join(
                InstrumentVersion,
                InstrumentVersion.instrument_id == Instrument.id,
            )
            .join(SourceFile, SourceFile.id == InstrumentVersion.source_file_id)
            .where(
                Instrument.isin == isin.upper(),
                InstrumentVersion.is_published.is_(True),
            )
            .order_by(InstrumentVersion.id.desc())
            .limit(1)
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instrument not found",
        )
    return _public_payload(*row)
