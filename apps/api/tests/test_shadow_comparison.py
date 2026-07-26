from app.services.valuation.shadow import compare_legacy_and_verified


def test_theoretical_legacy_difference_is_explained():
    differences, classification, explanation = compare_legacy_and_verified(
        {
            "dirty_price": "99",
            "accrued_interest": "1",
            "yield_to_maturity": "0.20",
            "modified_duration": "2",
            "macaulay_duration": "2.2",
            "is_theoretical": True,
        },
        {
            "dirty_price": "101",
            "accrued_amount": "1.2",
            "annual_yield": "0.18",
            "modified_duration": "2.1",
            "macaulay_duration": "2.3",
        },
    )
    assert differences
    assert classification == "EXPLAINED_LEGACY_THEORETICAL"
    assert "açık kullanıcı fiyatını" in explanation


def test_missing_legacy_is_not_fabricated():
    differences, classification, _ = compare_legacy_and_verified(
        None,
        {"dirty_price": "100"},
    )
    assert differences == {"legacy_result": "MISSING"}
    assert classification == "NO_LEGACY_BASELINE"
