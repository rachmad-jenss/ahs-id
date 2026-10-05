"""Tests for PDF verify number variants."""

from ahs_id.spot_check import _find_in_text, _float_variants, _idr_variants


def test_idr_variants_indonesian_thousands():
    patterns = _idr_variants(94286.86)
    assert "94.286,86" in patterns
    assert _find_in_text("Rp1 94.286,86 Rp / m3", patterns)


def test_float_variants_bm_semen():
    patterns = _float_variants(1301.9614)
    assert "1.301,9614" in patterns
    assert _find_in_text("Semen M12 Kg 1.301,9614 1.600,00", patterns)
