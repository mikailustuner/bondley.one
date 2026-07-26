from datetime import date
from decimal import Decimal

from app.services.bist_ingestion.benchmark_parser import BenchmarkParser


def test_index_reconstruction_uses_current_rate_and_next_business_gap():
    parser = BenchmarkParser()
    rates = {
        date(2026, 7, 16): (Decimal("39.9128"), 1),
        date(2026, 7, 17): (Decimal("39.9123"), 2),
        date(2026, 7, 20): (Decimal("39.8966"), 3),
        date(2026, 7, 21): (Decimal("39.8866"), 4),
    }
    index_16 = Decimal("1000")
    index_17 = index_16 * (Decimal("1") + Decimal("39.9123") / 100 * 3 / 365)
    index_20 = index_17 * (Decimal("1") + Decimal("39.8966") / 100 * 1 / 365)
    indexes = {
        date(2026, 7, 16): (index_16, 1),
        date(2026, 7, 17): (index_17, 2),
        date(2026, 7, 20): (index_20, 3),
        date(2026, 7, 21): (
            index_20 * (Decimal("1") + Decimal("39.8866") / 100 / 365),
            4,
        ),
    }
    dataset = parser.merge("TLREF", rates, indexes)
    parser.validate_index_series(dataset, tolerance=Decimal("1e-25"))
    assert len(dataset.validations) == 2
    friday = next(item for item in dataset.observations if item.observation_date == date(2026, 7, 17))
    assert friday.next_business_day_gap == 3
    expected_return = Decimal("39.9123") / 100 * 3 / 365
    assert abs(friday.period_return - expected_return) < Decimal("1e-27")
    assert all(item.passed for item in dataset.validations)


def test_daily_csv_parsing_keeps_published_percentage():
    rate = (
        "TARIH;AD;INGILIZCE ADI;KOD;ISIN;DEGER\r\n"
        "DATE;NAME;NAME IN ENGLISH;CODE;ISIN;VALUE\r\n"
        "24/07/2026;TLREF;TLREF;TLREF;TRIXIST00015;39.941\r\n"
    ).encode()
    index = (
        "KAYIT SIRA;ENDEKS KODU;ENDEKSLER;INDICES;KUR TURU;TARIH;KAPANIS\r\n"
        "ORDER;INDEX CODE;INDEX;INDEX;CURRENCY;DATE;CLOSING\r\n"
        "1;BISTTLREF;BIST TLREF;BIST TLREF;TRY;24/07/2026;6388.49162\r\n"
    ).encode()
    dataset = BenchmarkParser().parse_daily(
        "TLREF",
        rate_content=rate,
        index_content=index,
    )
    assert len(dataset.observations) == 1
    assert dataset.observations[0].published_annual_rate_pct == Decimal("39.941")
    assert dataset.observations[0].index_value == Decimal("6388.49162")
