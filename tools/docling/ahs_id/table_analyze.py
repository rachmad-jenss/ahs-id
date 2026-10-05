"""Classify, verify, and organize SDA Docling table extractions."""

from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

from ahs_id.table_clean import (
    _KODE_AHSP,
    _REF_CODE,
    _collapse_spaced_letters,
    clean_table,
    normalize_header,
    parse_id_number,
    split_koef_token_strings,
    split_koef_tokens,
    split_ref_kodes,
)

_KODE_ITEM = re.compile(r"^[A-Z]\.[\d\w\.]+$", re.I)
_BM_KODE_ITEM = re.compile(r"^\d+\.\d", re.I)
_CK_KODE_ITEM = re.compile(r"^\d+\.\d+\.\d+$", re.I)


class TableCategory(str, Enum):
    HSP_BREAKDOWN = "hsp_breakdown"
    ITEM_INDEX = "item_index"
    HSD_MATERIAL = "hsd_material"
    COEFFICIENT_OTHER = "coefficient_other"
    FORMULA_EQUIPMENT = "formula_or_equipment"
    OTHER = "other"


@dataclass
class TableIssue:
    table_index: int
    severity: str  # error | warn | info
    code: str
    message: str


@dataclass
class HspRow:
    section: str  # A|B|C|D|E|F|data
    no: str
    uraian: str
    kode: str
    satuan: str
    koefisien: float | None
    harga_satuan: float | None
    jumlah_harga: float | None


@dataclass
class AnalysisManifest:
    source_tables: int
    categories: dict[str, int]
    issues: list[TableIssue] = field(default_factory=list)
    hsp_verified: int = 0
    hsp_with_issues: int = 0
    index_items: int = 0
    unique_index_codes: int = 0


def _header_blob(columns: list[str]) -> str:
    parts: list[str] = []
    for col in columns:
        parts.append(normalize_header(col))
        parts.append(_collapse_spaced_letters(str(col)).lower())
    return " ".join(parts)


def classify_table(table: dict[str, Any]) -> TableCategory:
    cols = _header_blob(table.get("columns", []))
    if ("item_pekerjaan" in cols or "item pekerjaan" in cols) and "normatif" in cols:
        return TableCategory.ITEM_INDEX
    if (
        "normatif" in cols
        and "kode" in cols
        and "uraian" in cols
        and "komponen" not in cols
        and "harga_satuan" not in cols
        and "harga satuan" not in cols
    ):
        return TableCategory.ITEM_INDEX
    if (
        "kode" in cols
        and (
            "uraian pekerjaan" in cols
            or "uraian_pekerjaan" in cols
            or "item_pekerjaan" in cols
        )
        and ("tipe ahsp" in cols or "tipe_ahsp" in cols or "status" in cols)
        and "koef" not in cols
    ):
        return TableCategory.ITEM_INDEX
    if "harga_satuan" in cols or "harga satuan" in cols:
        if "uraian" in cols or "komponen" in cols:
            if "koefisien" in cols or "koef" in cols or "kuantitas" in cols or "perkiraan" in cols:
                return TableCategory.HSP_BREAKDOWN
    if "koefisien" in cols and "harga" in cols and "uraian" in cols:
        return TableCategory.HSP_BREAKDOWN
    if "hsd" in cols and "barang" in cols:
        return TableCategory.HSD_MATERIAL
    if "notasi rumus" in cols or "biaya operasi" in cols:
        return TableCategory.FORMULA_EQUIPMENT
    if "koefisien" in cols or "koef" in cols:
        return TableCategory.COEFFICIENT_OTHER
    return TableCategory.OTHER


def _first_col(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        if key in row and row[key]:
            return row[key]
    return ""


def _section_letter(row: dict[str, str]) -> str | None:
    no = _first_col(row, "no", "no_2").strip().upper().rstrip(".")
    uraian = _first_col(row, "uraian", "komponen").strip().upper()
    if re.fullmatch(r"[A-F]", no):
        return no
    if re.fullmatch(r"[A-F]\s*\d*", no):
        return no[0]
    if re.match(r"^[A-F]\.?\s*$", _first_col(row, "no", "no_2").strip().upper()):
        return no[0]
    for letter in "ABCDEF":
        if uraian.startswith(f"{letter} ") or uraian == letter:
            return letter
    return None


_UNIT_AS_KODE = re.compile(r"^m[23²³]$", re.I)


def _repair_unit_as_kode(record: dict[str, str]) -> dict[str, str]:
    """Docling sometimes puts satuan (m2) in kode and M.xx in uraian."""
    kode = _first_col(record, "kode", "komponen_2").strip()
    uraian = _first_col(record, "uraian", "komponen").strip()
    if _UNIT_AS_KODE.match(kode) and re.match(r"^M\.", uraian, re.I):
        row = dict(record)
        satuan_val = _first_col(record, "satuan")
        row["kode"] = uraian
        if "komponen_2" in row:
            row["komponen_2"] = uraian
        row["satuan"] = kode
        if satuan_val and not _first_col(record, "koefisien", "koef").strip():
            row["koefisien"] = satuan_val
        return row
    return record


def _repair_merged_tenaga_rows(records: list[dict[str, str]]) -> list[dict[str, str]]:
    """When L.01 row has two koefs and L.02 row is empty, split across both rows."""
    out: list[dict[str, str]] = []
    i = 0
    while i < len(records):
        rec = records[i]
        kode = _first_col(rec, "kode", "komponen_2").strip()
        koef_parts = split_koef_token_strings(
            _first_col(rec, "koefisien", "koef", "perkiraan_kuantitas")
        )
        if kode in {"L.01", "L01"} and len(koef_parts) >= 2 and i + 1 < len(records):
            nxt = records[i + 1]
            nk = _first_col(nxt, "kode", "komponen_2").strip()
            if nk in {"L.02", "L02"} and not _first_col(nxt, "koefisien", "koef").strip():
                satuan_parts = _first_col(rec, "satuan").split()
                r1 = dict(rec)
                r1["koefisien"] = koef_parts[0]
                if satuan_parts:
                    r1["satuan"] = satuan_parts[0]
                r2 = dict(nxt)
                r2["koefisien"] = koef_parts[1]
                if len(satuan_parts) >= 2:
                    r2["satuan"] = satuan_parts[1]
                out.extend([r1, r2])
                i += 2
                continue
        out.append(rec)
        i += 1
    return out


def _expand_hsp_record(record: dict[str, str]) -> list[dict[str, str]]:
    """Split rows where Docling merged multiple refs or koefisien into one cell."""
    record = _repair_unit_as_kode(record)
    kode_raw = _first_col(record, "kode", "komponen_2")
    koef_raw = _first_col(record, "koefisien", "koef", "perkiraan_kuantitas")
    kodes = split_ref_kodes(kode_raw)
    koef_parts = split_koef_token_strings(koef_raw)

    if len(kodes) > 1 and len(koef_parts) >= len(kodes):
        koef_parts = koef_parts[: len(kodes)]
        satuan_parts = _first_col(record, "satuan").split()
        if len(satuan_parts) != len(kodes):
            satuan_parts = [_first_col(record, "satuan")] * len(kodes)
        expanded: list[dict[str, str]] = []
        for i, kode in enumerate(kodes):
            row = dict(record)
            row["kode"] = kode
            if "komponen_2" in row:
                row["komponen_2"] = kode
            row["koefisien"] = koef_parts[i]
            row["satuan"] = satuan_parts[i]
            expanded.append(row)
        return expanded

    if len(kodes) == 1 and kodes[0] != kode_raw:
        row = dict(record)
        row["kode"] = kodes[0]
        if "komponen_2" in row:
            row["komponen_2"] = kodes[0]
        return [row]

    return [record]


def parse_hsp_breakdown(records: list[dict[str, str]]) -> list[HspRow]:
    """Parse cleaned HSP breakdown rows into structured records."""
    rows: list[HspRow] = []
    current_section = "data"

    for record in _repair_merged_tenaga_rows(records):
        for sub in _expand_hsp_record(record):
            section = _section_letter(sub)
            uraian = _first_col(sub, "uraian", "komponen")
            if section and uraian.lower().startswith(
                (
                    "tenaga kerja",
                    "tenaga",
                    "bahan",
                    "peralatan",
                    "peralat",
                    "jumlah harga",
                    "biaya umum",
                    "overhead",
                    "harga satuan pekerjaan",
                )
            ):
                current_section = section

            if uraian.lower().startswith("jumlah harga") and not _first_col(sub, "kode", "komponen_2"):
                continue

            rows.append(
                HspRow(
                    section=current_section,
                    no=_first_col(sub, "no"),
                    uraian=uraian,
                    kode=_first_col(sub, "kode", "komponen_2"),
                    satuan=_first_col(sub, "satuan"),
                    koefisien=parse_id_number(
                        _first_col(sub, "koefisien", "koef", "perkiraan_kuantitas")
                    ),
                    harga_satuan=parse_id_number(_first_col(sub, "harga_satuan")),
                    jumlah_harga=parse_id_number(
                        _first_col(sub, "jumlah_harga", "jumlah_harga_rp")
                    ),
                )
            )
    return rows


def verify_hsp_table(table_index: int, records: list[dict[str, str]]) -> list[TableIssue]:
    """Layer 1 heuristics for standard AHSP breakdown tables."""
    issues: list[TableIssue] = []
    parsed = parse_hsp_breakdown(records)

    has_tk_header = any("tenaga" in r.uraian.lower() for r in parsed)
    if not has_tk_header:
        return issues  # partial / non-standard table — skip strict checks

    tk_rows = [r for r in parsed if r.section == "A" and r.kode and _REF_CODE.match(r.kode)]
    if tk_rows and all(r.koefisien is None for r in tk_rows):
        issues.append(
            TableIssue(
                table_index,
                "info",
                "hsp_template",
                "HSD template — section A koefisien empty (fill at calculation time)",
            )
        )
        return issues

    sections = {r.section for r in parsed if r.section in "ABCDEF"}
    for letter in "ABCDEF":
        if letter not in sections:
            issues.append(
                TableIssue(
                    table_index,
                    "warn",
                    "missing_section",
                    f"Section {letter} not found",
                )
            )

    tk_rows = [r for r in parsed if r.section == "A" and r.kode and _REF_CODE.match(r.kode)]
    if not tk_rows:
        issues.append(
            TableIssue(
                table_index,
                "warn",
                "no_tenaga_kerja",
                "No TK rows with ref codes in section A",
            )
        )

    for row in tk_rows:
        if row.koefisien is None:
            issues.append(
                TableIssue(
                    table_index,
                    "error",
                    "invalid_koefisien",
                    f"TK {row.kode}: koefisien not parseable",
                )
            )

    f_rows = [r for r in parsed if r.section == "F" or "harga satuan pekerjaan" in r.uraian.lower()]
    if f_rows:
        total = f_rows[-1].jumlah_harga
        if total is None:
            issues.append(
                TableIssue(
                    table_index,
                    "info",
                    "missing_hsp_total",
                    "Row F has no parseable Harga Satuan Pekerjaan (HSD template / unfilled)",
                )
            )
    else:
        issues.append(TableIssue(table_index, "warn", "no_row_f", "No Harga Satuan Pekerjaan row"))

    equip = [
        r
        for r in parsed
        if r.section == "C" and r.kode and re.match(r"^E", r.kode, re.I)
    ]
    for row in equip:
        if row.koefisien is None:
            issues.append(
                TableIssue(
                    table_index,
                    "warn",
                    "invalid_equip_koef",
                    f"Equipment {row.kode}: koefisien not parseable",
                )
            )

    return issues


def verify_index_table(table_index: int, records: list[dict[str, str]]) -> list[TableIssue]:
    issues: list[TableIssue] = []
    codes_seen = 0
    for row in records:
        kode = _first_col(row, "kode")
        if not kode:
            continue
        if not _KODE_ITEM.match(kode):
            issues.append(
                TableIssue(
                    table_index,
                    "info",
                    "odd_kode_format",
                    f"Kode {kode!r} does not match expected SDA pattern",
                )
            )
        codes_seen += 1
    if codes_seen == 0:
        issues.append(TableIssue(table_index, "warn", "empty_index", "No item codes in index table"))
    return issues


def _write_csv(path: Path, columns: list[str], records: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in records:
            writer.writerow({c: row.get(c, "") for c in columns})


def analyze_and_clean(
    tables_path: Path,
    output_dir: Path,
    *,
    write_by_type: bool = True,
) -> AnalysisManifest:
    """
    Load raw tables JSON, clean, classify, verify, and write organized outputs.

    Outputs under *output_dir*:
    - manifest.json — counts, issues, category breakdown
    - item-index.csv — merged item catalogue tables
    - hsp-parsed.jsonl — structured HSP rows per table (one JSON object per line)
    - by-type/<category>/table-NNNN.csv — cleaned CSVs by category
    """
    raw_tables: list[dict[str, Any]] = json.loads(tables_path.read_text(encoding="utf-8"))
    manifest = AnalysisManifest(source_tables=len(raw_tables), categories={})

    cleaned_tables: list[dict[str, Any]] = []
    index_rows: list[dict[str, str]] = []
    index_codes: set[str] = set()
    hsp_parsed_path = output_dir / "hsp-parsed.jsonl"
    hsp_parsed_path.parent.mkdir(parents=True, exist_ok=True)

    with hsp_parsed_path.open("w", encoding="utf-8") as hsp_out:
        for raw in raw_tables:
            category = classify_table(raw)
            cleaned = clean_table(
                raw,
                drop_jumlah_spam=category == TableCategory.HSP_BREAKDOWN,
            )
            category = classify_table(cleaned)
            manifest.categories[category.value] = manifest.categories.get(category.value, 0) + 1
            cleaned["category"] = category.value
            cleaned_tables.append(cleaned)

            if category == TableCategory.ITEM_INDEX:
                for row in cleaned["records"]:
                    kode = row.get("kode", "")
                    if kode and (
                        _KODE_ITEM.match(kode)
                        or _BM_KODE_ITEM.match(kode)
                        or _CK_KODE_ITEM.match(kode)
                    ):
                        index_codes.add(kode)
                    index_rows.append(row)
                manifest.issues.extend(verify_index_table(cleaned["index"], cleaned["records"]))

            elif category == TableCategory.HSP_BREAKDOWN:
                issues = verify_hsp_table(cleaned["index"], cleaned["records"])
                manifest.issues.extend(issues)
                has_error = any(i.severity == "error" for i in issues)
                if has_error:
                    manifest.hsp_with_issues += 1
                else:
                    manifest.hsp_verified += 1

                parsed = parse_hsp_breakdown(cleaned["records"])
                payload = {
                    "table_index": cleaned["index"],
                    "row_count": len(parsed),
                    "sections": sorted({r.section for r in parsed}),
                    "coefficients": [
                        {
                            "section": r.section,
                            "kode": r.kode or None,
                            "uraian": r.uraian,
                            "satuan": r.satuan,
                            "koefisien": r.koefisien,
                        }
                        for r in parsed
                        if r.koefisien is not None and (r.kode or r.uraian)
                    ],
                    "harga_satuan_pekerjaan": next(
                        (r.jumlah_harga for r in parsed if r.section == "F"),
                        None,
                    ),
                    "issues": [{"code": i.code, "severity": i.severity, "message": i.message} for i in issues],
                }
                hsp_out.write(json.dumps(payload, ensure_ascii=False) + "\n")

            if write_by_type:
                rel = output_dir / "by-type" / category.value / f"table-{cleaned['index'] + 1:04d}.csv"
                _write_csv(rel, cleaned["columns"], cleaned["records"])

    manifest.index_items = len(index_rows)
    manifest.unique_index_codes = len(index_codes)

    # Merged index
    if index_rows:
        index_cols = sorted({k for row in index_rows for k in row.keys()})
        _write_csv(output_dir / "item-index.csv", index_cols, index_rows)

    # Cleaned master JSON (compact records)
    master_path = output_dir / "tables-cleaned.json"
    master_path.write_text(
        json.dumps(cleaned_tables, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Issue summary by code
    issue_counts: dict[str, int] = {}
    for issue in manifest.issues:
        issue_counts[issue.code] = issue_counts.get(issue.code, 0) + 1

    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "source": str(tables_path),
                "source_tables": manifest.source_tables,
                "categories": manifest.categories,
                "hsp_breakdown": {
                    "total": manifest.categories.get(TableCategory.HSP_BREAKDOWN.value, 0),
                    "verified_ok": manifest.hsp_verified,
                    "with_issues": manifest.hsp_with_issues,
                },
                "item_index": {
                    "rows": manifest.index_items,
                    "unique_codes": manifest.unique_index_codes,
                },
                "issue_counts": issue_counts,
                "issues": [
                    {
                        "table_index": i.table_index,
                        "severity": i.severity,
                        "code": i.code,
                        "message": i.message,
                    }
                    for i in manifest.issues
                    if i.severity in ("error", "warn")
                ][:500],
                "info_counts": {
                    code: sum(1 for i in manifest.issues if i.code == code and i.severity == "info")
                    for code in {i.code for i in manifest.issues if i.severity == "info"}
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return manifest
