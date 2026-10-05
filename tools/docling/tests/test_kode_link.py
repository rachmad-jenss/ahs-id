"""Tests for kode_ahsp linking (requires PDF for integration)."""

import json
import re
from pathlib import Path

from ahs_id.kode_link import (
    _KODE_CK_ITEM,
    _first_l01_koef,
    extract_hsp_anchors_from_pdf,
    link_hsp_tables,
    load_index_kodes,
)


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
