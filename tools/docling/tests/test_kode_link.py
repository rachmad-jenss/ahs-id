"""Tests for kode_ahsp linking (requires PDF for integration)."""

import json
import re
from pathlib import Path

from ahs_id.kode_link import (
    _KODE_CK_ITEM,
    _first_l01_koef,
    _is_sda_item_kode,
    _iter_sda_inline_matches,
    _linkable_for_sda,
    extract_hsp_anchors_from_pdf,
    link_hsp_tables,
    load_index_kodes,
)


def test_ck_inline_optional_space_before_uraian():
    from ahs_id.kode_link import _KODE_CK_INLINE

    text = "3.13.2Pemasangan 1 m2 Profil\nA TENAGA KERJA\n1 Pekerja L.01 OH 0,0430"
    m = _KODE_CK_INLINE.search(text)
    assert m is not None
    assert m.group(1) == "3.13.2"


def test_ck_inline_regex_matches_item_header():
    text = "3.13.2 Pemasangan 1 m2 Profil Jalusi Aluminium\nA TENAGA KERJA"
    m = _KODE_CK_ITEM.search(text)
    assert m is not None
    assert m.group(1) == "3.13.2"
    assert "Pemasangan" in m.group(2)


def test_ck_inline_requires_tenaga_kerja_block():
    text = "3.13.2 Pemasangan 1 m2 Profil\nB BAHAN\n1 Semen M.01 0,5"
    block = text
    assert not re.search(r"A\s+TENAGA\s+KERJA", block, re.I)


def test_first_l01_koef_parses_pdf_block():
    block = "1 Pekerja L.01 OJ 0,00306 21.428,57 65,57"
    assert _first_l01_koef(block) == 0.00306


def test_sda_inline_kode_without_space_before_uraian():
    text = (
        "A.3.05.2b.1.b(VPD) Per-m' penetrasi Tiang beton\r\n"
        "1 2 3 4 5 6 7\r\nA Tenaga Kerja\r\n1 Pekerja L.01 OJ 0,0943"
    )
    matches = _iter_sda_inline_matches(text)
    assert matches and matches[0].group(1) == "A.3.05.2b.1.b"


def test_is_sda_item_kode_rejects_time_refs():
    assert _is_sda_item_kode("T.04.a.1") is True
    assert _is_sda_item_kode("TM.04.2.a") is True
    assert _is_sda_item_kode("T.1") is False


def test_l01_from_row_parses_combined_kode():
    from ahs_id.kode_link import _l01_from_hsp_row

    row = {
        "coefficients": [
            {"kode": "L.01 L.02", "uraian": "Pekerja", "koefisien": 3.1226},
        ],
    }
    assert _l01_from_hsp_row(row) == 3.1226


def test_linkable_for_sda_harga_without_l01():
    row = {
        "sections": ["A", "B", "C", "D", "E", "F"],
        "coefficients": [{"section": "C", "kode": "E.15.e", "koefisien": 1.0}],
        "harga_satuan_pekerjaan": 18631.82,
    }
    assert _linkable_for_sda(row) is True
    assert _linkable_for_sda({"sections": ["data"], "coefficients": []}) is False


def test_link_hsp_page_unique_no_l01(tmp_path: Path):
    anchors = [
        type("A", (), {"kode_ahsp": "A.9.99.1", "uraian": "Eq only", "page": 42, "l01_koef": None})(),
    ]
    hsp_file = tmp_path / "hsp.jsonl"
    hsp_file.write_text(
        json.dumps(
            {
                "table_index": 5,
                "sections": ["C", "D", "E"],
                "coefficients": [{"section": "C", "koefisien": 1.0}],
                "harga_satuan_pekerjaan": 1000.0,
            }
        )
        + "\n",
        encoding="utf-8",
    )
    linked = link_hsp_tables(hsp_file, anchors, page_map={5: (42, 42)})
    assert linked[0]["kode_ahsp"] == "A.9.99.1"
    assert linked[0]["kode_link_method"] == "page_unique_no_l01"


def test_link_hsp_sequential(tmp_path: Path):
    anchors = [
        type("A", (), {"kode_ahsp": "A.1.01.a.1", "uraian": "Test", "page": 1, "l01_koef": 0.01})(),
    ]
    hsp_file = tmp_path / "hsp.jsonl"
    hsp_file.write_text(
        json.dumps(
            {
                "table_index": 0,
                "coefficients": [{"kode": "L.01", "koefisien": 0.01}],
                "harga_satuan_pekerjaan": 100.0,
            }
        )
        + "\n",
        encoding="utf-8",
    )
    linked = link_hsp_tables(hsp_file, anchors, page_map={0: (1, 10)})
    assert linked[0]["kode_ahsp"] == "A.1.01.a.1"


PDF_PATH = Path(
    r"D:\Downloads\Documents\Lampiran-IV-SE-DJBK-No-47-Tahun-2026-AHSP-Bidang-Sumber-Daya-Air.pdf"
)
INDEX_PATH = Path("output/sda-se-47-2026/cleaned/item-index.csv")


def test_pdf_anchor_table_81_kode():
    if not PDF_PATH.is_file() or not INDEX_PATH.is_file():
        return
    anchors = extract_hsp_anchors_from_pdf(PDF_PATH, valid_kodes=None, page_start=80, page_end=85)
    kodes = [a.kode_ahsp for a in anchors]
    assert "A.3.01.1a.1" in kodes
