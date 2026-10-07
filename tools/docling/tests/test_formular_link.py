"""Tests for formular boundary linking (no full PDF required)."""

from __future__ import annotations

import json
from pathlib import Path

from ahs_id.formular_link import (
    FormularBlock,
    PageMeta,
    _extract_kode_from_page,
    _linkable_for_formular,
    extract_formular_blocks,
    link_hsp_via_formulars,
    page_meta_from_text,
)


def test_page_meta_detects_asumsi_and_hsp():
    asumsi = page_meta_from_text(
        47,
        "B.1 Galian (2.1.(1))\nI. ASUMSI\n1. Menggunakan alat berat",
    )
    assert asumsi.kode == "2.1.(1)"
    assert asumsi.has_asumsi

    hsp = page_meta_from_text(
        49,
        "PERKIRAAN HARGA JUMLAH\n1. Pekerja L01 jam 0,2914 27.643,54",
    )
    assert hsp.is_hsp
    assert hsp.l01_koef == 0.2914


def test_page_meta_detects_split_hsp_header():
    hsp = page_meta_from_text(
        392,
        "PERKIRAAN HARGA\nNO. KOMPONEN SATUAN KUANTITAS SATUAN\nA. TENAGA\n1. Pekerja L01 Jam 0,0229",
    )
    assert hsp.is_hsp
    assert hsp.l01_koef == 0.0229


def test_extract_kode_data_dan_asumsi():
    text = (
        "H.9 Perkuatan Struktur dengan Bahan FRP\n"
        "Kering (8.4.(1))\n"
        "I. DATA DAN ASUMSI\n"
        "1 Pekerjaan dilakukan secara manual"
    )
    kode, uraian = _extract_kode_from_page(text)
    assert kode == "8.4.(1)"


def test_extract_formular_blocks_lookahead_kode():
    """BM Lamp. V: kode on page after HSP breakdown."""
    index = [
        PageMeta(386, True, False, None, None, 0.0229),
        PageMeta(387, False, True, "3.2.(2c1)", "C.27 Timbunan", None),
    ]
    blocks = extract_formular_blocks(index)
    assert len(blocks) == 1
    assert blocks[0].kode_ahsp == "3.2.(2c1)"
    assert blocks[0].hsp_page == 386


def test_extract_formular_blocks_pairs_hsp_with_title():
    index = [
        PageMeta(47, False, True, "2.1.(1)", "Galian", None),
        PageMeta(48, False, False, None, None, None),
        PageMeta(49, True, False, None, None, 0.2914),
        PageMeta(50, False, True, "2.2.(1)", "Pasangan Batu", None),
        PageMeta(52, True, False, None, None, 1.6064),
    ]
    blocks = extract_formular_blocks(index)
    assert len(blocks) == 2
    assert blocks[0].kode_ahsp == "2.1.(1)"
    assert blocks[0].hsp_page == 49
    assert blocks[1].kode_ahsp == "2.2.(1)"
    assert blocks[1].hsp_page == 52


def test_link_hsp_via_formulars_expanded_window(tmp_path: Path):
    blocks = [
        FormularBlock("7.12.(1b)", "Landasan", 1355, 1358, 2.3333),
        FormularBlock("7.12.(1b)", "Landasan", 1355, 1360, 2.3333),
    ]
    hsp_file = tmp_path / "hsp.jsonl"
    rows = [
        {"table_index": 1356, "coefficients": [{"uraian": "Pekerja L01", "koefisien": 2.3333}]},
        {"table_index": 1358, "coefficients": [{"uraian": "Pekerja", "koefisien": 2.3333}]},
    ]
    hsp_file.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    linked = link_hsp_via_formulars(hsp_file, blocks, page_map={1356: (1361, 1370), 1358: (1361, 1370)})
    by_idx = {r["table_index"]: r for r in linked}
    assert by_idx[1356]["kode_ahsp"] == "7.12.(1b)"
    assert by_idx[1358]["kode_ahsp"] == "7.12.(1b)"


def test_linkable_for_formular_hsp_total_only():
    row = {
        "sections": ["B", "E", "F"],
        "coefficients": [],
        "harga_satuan_pekerjaan": 476699.97,
    }
    assert _linkable_for_formular(row) is True


def test_linkable_for_formular_equipment_only():
    row = {
        "sections": ["B", "E"],
        "coefficients": [{"section": "B", "uraian": "Water Tanker", "koefisien": 1.0}],
        "harga_satuan_pekerjaan": None,
    }
    assert _linkable_for_formular(row) is True


def test_link_hsp_via_formulars_equipment_on_hsp_page(tmp_path: Path):
    blocks = [FormularBlock("9.1.(6)", "Truk Tangki", 1747, 1748, None)]
    hsp_file = tmp_path / "hsp.jsonl"
    hsp_file.write_text(
        json.dumps(
            {
                "table_index": 10,
                "sections": ["B"],
                "coefficients": [{"section": "B", "koefisien": 1.0, "uraian": "Tanker"}],
            }
        )
        + "\n",
        encoding="utf-8",
    )
    linked = link_hsp_via_formulars(hsp_file, blocks, page_map={10: (1748, 1748)})
    assert linked[0]["kode_ahsp"] == "9.1.(6)"
    assert linked[0]["kode_link_method"] == "formular_hsp_page"


def test_link_hsp_via_formulars_l01_match(tmp_path: Path):
    blocks = [
        FormularBlock("2.2.(1)", "Pasangan Batu", 50, 52, 1.6064),
    ]
    hsp_file = tmp_path / "hsp.jsonl"
    hsp_file.write_text(
        json.dumps(
            {
                "table_index": 46,
                "coefficients": [{"kode": "L01", "uraian": "Pekerja", "koefisien": 1.6064}],
                "harga_satuan_pekerjaan": 1000948.81,
            }
        )
        + "\n",
        encoding="utf-8",
    )
    linked = link_hsp_via_formulars(hsp_file, blocks, page_map={46: (51, 60)})
    assert linked[0]["kode_ahsp"] == "2.2.(1)"
    assert linked[0]["kode_link_method"] == "formular_l01_unique"
