"""Tests for bundle loading and verification heuristics (no Docling required)."""

from ahs_id.bundle import collect_coefficients, collect_package_coefficients, repo_root
from ahs_id.verify import MatchStatus, verify_coefficient_in_text


def test_repo_root_exists():
    root = repo_root()
    assert (root / "packages" / "pupr-2023").is_dir()


def test_collect_pupr_3_2_1_coefficients():
    refs = collect_package_coefficients("pupr-2023", kode_filter="3.2.1", root=repo_root())
    values = {r.ref: r.value for r in refs if r.ref}
    assert values.get("L.01") == 0.065
    assert values.get("L.04") == 0.007
    assert values.get("M.09.a") == 1.025


def test_verify_finds_known_coefficient_in_synthetic_text():
    refs = collect_package_coefficients("pupr-2023", kode_filter="3.2.1", root=repo_root())
    pekerja = next(r for r in refs if r.ref == "L.01")
    text = """
    3.2.1 Lapis Pondasi Agregat Kelas A
    Tenaga Kerja (L.01) Pekerja 0,065 OH
    """
    row = verify_coefficient_in_text(pekerja, text)
    assert row.status == MatchStatus.FOUND


def test_verify_missing_kode():
    refs = collect_package_coefficients("pupr-2023", kode_filter="3.2.1", root=repo_root())
    pekerja = next(r for r in refs if r.ref == "L.01")
    row = verify_coefficient_in_text(pekerja, "no ahsp codes here 0.065")
    assert row.status == MatchStatus.NOT_FOUND


def test_collect_coefficients_skips_dynamic_tk():
    item = {
        "kode_ahsp": "9.9.9",
        "tenaga_kerja": [{"ref": "L.01", "koefisien": 1.0, "koef_sumber": "kalkulasi"}],
        "bahan": [],
        "peralatan": [],
    }
    assert collect_coefficients(item) == []
