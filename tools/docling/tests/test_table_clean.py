"""Tests for table cleaning and analysis (no Docling required)."""

import json
from pathlib import Path

from ahs_id.table_analyze import (
    TableCategory,
    analyze_and_clean,
    classify_table,
    parse_hsp_breakdown,
    verify_hsp_table,
)
from ahs_id.table_clean import (
    clean_cell,
    clean_records,
    is_numbering_row,
    normalize_header,
    parse_id_number,
    remap_columns,
)


def test_normalize_header_merged_columns():
    assert normalize_header("No .No") == "no"
    assert normalize_header("U r a i a n") == "uraian"
    assert normalize_header("Harga  Satuan  (Rp)") == "harga_satuan"


def test_clean_cell_m3_unit():
    assert clean_cell("Bucket 0,90 m3") == "Bucket 0,90 m³"


def test_is_numbering_row():
    row = {"no": "1", "uraian": "2", "kode": "3", "satuan": "4", "koefisien": "5"}
    assert is_numbering_row(row)


def test_parse_id_number_indonesian():
    assert parse_id_number("0,0173") == 0.0173
    assert parse_id_number("21.428,57") == 21428.57
    assert parse_id_number("#") is None
    assert parse_id_number("1 1,33") == 1.33


def test_split_ref_kodes():
    from ahs_id.table_clean import split_koef_tokens, split_ref_kodes

    assert split_ref_kodes("M . 23") == ["M.23"]
    assert split_ref_kodes("M.25.c M.05.b.3") == ["M.25.c", "M.05.b.3"]


def test_split_koef_tokens():
    from ahs_id.table_clean import split_koef_tokens

    assert split_koef_tokens("512 0,263") == [512.0, 0.263]


def test_parse_hsp_splits_merged_material_row():
    columns = ["no", "uraian", "kode", "satuan", "koefisien"]
    records = [
        {"no": "B", "uraian": "Bahan Bata merah Pasir Pasang", "kode": "M.25.c M.05.b.3", "satuan": "Buah m³", "koefisien": "512 0,263"},
    ]
    parsed = parse_hsp_breakdown(records)
    by_kode = {r.kode: r.koefisien for r in parsed if r.kode.startswith("M.")}
    assert by_kode["M.25.c"] == 512.0
    assert by_kode["M.05.b.3"] == 0.263


def test_parse_hsp_splits_merged_tenaga_row():
    records = [
        {
            "no": "A",
            "uraian": "Tenaga Kerja Pekerja",
            "kode": "L.01 L.02",
            "satuan": "OH OH",
            "koefisien": "1,350 0,675 0,135",
        },
    ]
    parsed = parse_hsp_breakdown(records)
    by_kode = {r.kode: r.koefisien for r in parsed if r.kode in {"L.01", "L.02"}}
    assert by_kode["L.01"] == 1.35
    assert by_kode["L.02"] == 0.675


def test_parse_hsp_splits_merged_tenaga_across_rows():
    """SDA table 375: L.01 carries both koefs; L.02 row empty."""
    records = [
        {
            "no": "A 1",
            "uraian": "Tenaga Kerja Pekerja",
            "kode": "L.01",
            "satuan": "OH OH",
            "koefisien": "0,130 0,130",
        },
        {"no": "2", "uraian": "Tukang batu", "kode": "L.02", "satuan": "", "koefisien": ""},
    ]
    parsed = parse_hsp_breakdown(records)
    by_kode = {r.kode: r.koefisien for r in parsed if r.kode in {"L.01", "L.02"}}
    assert by_kode["L.01"] == 0.13
    assert by_kode["L.02"] == 0.13


def test_parse_hsp_repairs_unit_in_kode_column():
    """SDA table 457: satuan m2 misplaced in kode column."""
    records = [
        {
            "no": "4 Floordeck galv",
            "uraian": "M.67.a",
            "kode": "m2",
            "satuan": "1,08",
            "koefisien": "",
        },
    ]
    parsed = parse_hsp_breakdown(records)
    row = next(r for r in parsed if r.kode == "M.67.a")
    assert row.satuan.lower() == "m2"
    assert row.koefisien == 1.08


def test_verify_hsp_no_error_after_tenaga_split():
    from ahs_id.table_analyze import verify_hsp_table

    records = [
        {"no": "A", "uraian": "Tenaga Kerja", "kode": "", "satuan": "", "koefisien": ""},
        {
            "no": "1",
            "uraian": "Pekerja",
            "kode": "L.01",
            "satuan": "OH OH",
            "koefisien": "0,130 0,130",
        },
        {"no": "2", "uraian": "Tukang batu", "kode": "L.02", "satuan": "", "koefisien": ""},
        {"no": "3", "uraian": "Mandor", "kode": "L.04", "satuan": "OH", "koefisien": "0,013"},
    ]
    issues = verify_hsp_table(375, records)
    assert not any(i.code == "invalid_koefisien" for i in issues)


def test_parse_hsp_three_material_mortar_o():
    records = [
        {
            "no": "B",
            "uraian": "Bahan Bata merah Pasir Pasang Portland Cement",
            "kode": "M.25.c M.05.b.3 M.23",
            "satuan": "Buah m³ kg",
            "koefisien": "512 0,3570 91",
        },
    ]
    parsed = parse_hsp_breakdown(records)
    by_kode = {r.kode: r.koefisien for r in parsed if r.kode and r.kode.startswith("M.")}
    assert by_kode["M.25.c"] == 512.0
    assert by_kode["M.05.b.3"] == 0.357
    assert by_kode["M.23"] == 91.0


def test_parse_hsp_portland_cement_qty_koef():
    columns = ["no", "uraian", "kode", "satuan", "koefisien"]
    records = [
        {"no": "B", "uraian": "Bahan Beton L - shape", "kode": "M . 23", "satuan": "Buah m³", "koefisien": "1 1,33"},
    ]
    parsed = parse_hsp_breakdown(records)
    row = next(r for r in parsed if r.kode == "M.23")
    assert row.koefisien == 1.33


def test_classify_hsp_breakdown():
    table = {
        "columns": ["No.", "Uraian", "Kode", "Satuan", "Koefisien", "Harga Satuan (Rp)"],
        "records": [],
    }
    assert classify_table(table) == TableCategory.HSP_BREAKDOWN


def test_classify_bina_marga_komponen_hsp():
    table = {
        "columns": [
            "NO.",
            "KOMPONEN",
            "KOMPONEN_1",
            "SATUAN",
            "PERKIRAAN  KUANTITAS",
            "HARGA  SATUAN  (Rp.)",
            "JUMLAH HARGA (Rp.)",
        ],
        "records": [],
    }
    assert classify_table(table) == TableCategory.HSP_BREAKDOWN


def test_remap_komponen_columns():
    cols = remap_columns(["KOMPONEN", "KOMPONEN_1", "PERKIRAAN  KUANTITAS"])
    assert cols == ["uraian", "kode", "koefisien"]


def test_parse_bina_marga_hsp_sample():
    columns = [
        "NO.",
        "KOMPONEN",
        "KOMPONEN_1",
        "SATUAN",
        "PERKIRAAN  KUANTITAS",
        "HARGA  SATUAN  (Rp.)",
        "JUMLAH HARGA (Rp.)",
    ]
    records = [
        {
            "NO.": "A.",
            "KOMPONEN": "TENAGA",
            "KOMPONEN_1": "TENAGA",
            "SATUAN": "",
            "PERKIRAAN  KUANTITAS": "",
            "HARGA  SATUAN  (Rp.)": "",
            "JUMLAH HARGA (Rp.)": "",
        },
        {
            "NO.": "1.",
            "KOMPONEN": "Pekerja",
            "KOMPONEN_1": "L01",
            "SATUAN": "jam",
            "PERKIRAAN  KUANTITAS": "1,6064",
            "HARGA  SATUAN  (Rp.)": "27.643,54",
            "JUMLAH HARGA (Rp.)": "44.407,29",
        },
    ]
    _, cleaned = clean_records(columns, records)
    parsed = parse_hsp_breakdown(cleaned)
    pekerja = next(r for r in parsed if r.kode == "L01")
    assert pekerja.koefisien == 1.6064
    assert pekerja.section == "A"


def test_parse_hsp_sample():
    columns = ["No.", "Uraian", "Kode", "Satuan", "Koefisien", "Harga Satuan (Rp)", "Jumlah Harga (Rp)"]
    records = [
        {"No.": "1", "Uraian": "2", "Kode": "3", "Satuan": "4", "Koefisien": "5", "Harga Satuan (Rp)": "6", "Jumlah Harga (Rp)": "7"},
        {"No.": "A", "Uraian": "Tenaga Kerja", "Kode": "", "Satuan": "", "Koefisien": "", "Harga Satuan (Rp)": "", "Jumlah Harga (Rp)": ""},
        {"No.": "1", "Uraian": "Pekerja", "Kode": "L.01", "Satuan": "OJ", "Koefisien": "0,0173", "Harga Satuan (Rp)": "21.428,57", "Jumlah Harga (Rp)": "370,71"},
        {"No.": "F", "Uraian": "Harga Satuan Pekerjaan (D+E)", "Kode": "", "Satuan": "", "Koefisien": "", "Harga Satuan (Rp)": "", "Jumlah Harga (Rp)": "6.359,50"},
    ]
    _, cleaned = clean_records(columns, records)
    parsed = parse_hsp_breakdown(cleaned)
    pekerja = next(r for r in parsed if r.kode == "L.01")
    assert pekerja.koefisien == 0.0173
    assert pekerja.section == "A"


def test_analyze_and_clean_writes_manifest(tmp_path: Path):
    tables = [
        {
            "index": 0,
            "rows": 2,
            "cols": 5,
            "columns": ["No", "Kode", "Item Pekerjaan", "Satuan", "Normatif /  Informatif"],
            "records": [
                {"No": "1", "Kode": "A.1.01.a.1", "Item Pekerjaan": "Test item", "Satuan": "m2", "Normatif /  Informatif": "Normatif"},
            ],
        }
    ]
    src = tmp_path / "tables.json"
    src.write_text(json.dumps(tables), encoding="utf-8")
    out = tmp_path / "cleaned"
    manifest = analyze_and_clean(src, out)
    assert manifest.unique_index_codes == 1
    assert (out / "manifest.json").is_file()
    assert (out / "item-index.csv").is_file()


def test_verify_hsp_template_skips_tk_errors():
    columns = ["No.", "Uraian", "Kode", "Satuan", "Koefisien"]
    records = [
        {"No.": "A", "Uraian": "Tenaga Kerja", "Kode": "", "Satuan": "", "Koefisien": ""},
        {"No.": "1", "Uraian": "Pekerja", "Kode": "L.01", "Satuan": "OJ", "Koefisien": ""},
        {"No.": "2", "Uraian": "Mandor", "Kode": "L.04", "Satuan": "OJ", "Koefisien": ""},
    ]
    _, cleaned = clean_records(columns, records)
    issues = verify_hsp_table(0, cleaned)
    assert any(i.code == "hsp_template" for i in issues)
    assert not any(i.code == "invalid_koefisien" for i in issues)


def test_verify_hsp_flags_missing_koefisien():
    columns = ["No.", "Uraian", "Kode", "Satuan", "Koefisien"]
    records = [
        {"No.": "A", "Uraian": "Tenaga Kerja", "Kode": "", "Satuan": "", "Koefisien": ""},
        {"No.": "1", "Uraian": "Pekerja", "Kode": "L.01", "Satuan": "OJ", "Koefisien": "0,5"},
        {"No.": "2", "Uraian": "Tukang", "Kode": "L.02", "Satuan": "OJ", "Koefisien": "bad"},
    ]
    _, cleaned = clean_records(columns, records)
    issues = verify_hsp_table(0, cleaned)
    assert any(i.code == "invalid_koefisien" for i in issues)
