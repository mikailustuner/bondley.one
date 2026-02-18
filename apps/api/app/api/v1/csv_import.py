from datetime import date

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bond import Bond
from app.models.market_data import MarketData
from app.models.user import User
from app.services.csv_parser import CSVParser
from app.api.deps import get_admin_user

router = APIRouter()


@router.post("/csv", response_model=dict)
async def import_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

    parser = CSVParser()
    try:
        rows = parser.parse_file(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    if not rows:
        return {"status": "warning", "message": "No bond data found in file", "imported": 0}

    imported_count = 0
    skipped_count = 0

    for row in rows:
        bond_result = await db.execute(
            select(Bond).where(Bond.isin_code == row.isin_code)
        )
        bond = bond_result.scalar_one_or_none()

        if not bond:
            skipped_count += 1
            continue

        if row.clean_price is not None:
            stmt = pg_insert(MarketData).values(
                bond_id=bond.id,
                trade_date=date.today(),
                clean_price=row.clean_price,
                tlref_index=row.tlref_index,
                fark=row.fark,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["bond_id", "trade_date"],
                set_={
                    "clean_price": stmt.excluded.clean_price,
                    "tlref_index": stmt.excluded.tlref_index,
                    "fark": stmt.excluded.fark,
                },
            )
            await db.execute(stmt)
            imported_count += 1

    await db.commit()

    return {
        "status": "success",
        "imported": imported_count,
        "skipped": skipped_count,
        "total_parsed": len(rows),
    }
