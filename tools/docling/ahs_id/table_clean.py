"""Normalize and clean Docling-extracted regulation tables."""

from __future__ import annotations

import re
from typing import Any

# Canonical header names for SDA AHSP tables
_HEADER_ALIASES: dict[str, str] = {
    "no": "no",
    "no.": "no",
    "uraian": "uraian",
    "kode": "kode",
    "satuan": "satuan",
    "koefisien": "koefisien",
    "harga satuan (rp)": "harga_satuan",
    "harga satuan (rp.)": "harga_satuan",
    "harga  satuan  (rp)": "harga_satuan",
    "harga satuan": "harga_satuan",
    "jumlah harga (rp)": "jumlah_harga",
    "jumlah  harga  (rp)": "jumlah_harga",
    "jumlah harga": "jumlah_harga",
    "item pekerjaan": "item_pekerjaan",
    "normatif / informatif": "normatif_informatif",
    "normatif/informatif": "normatif_informatif",
    "keterangan": "keterangan",
    "hsd barang/ material ( rp. )": "hsd_barang",
    "koef.": "koefisien",
    "koef": "koefisien",
    "perkiraan kuantitas": "koefisien",
    "jumlah harga (rp.)": "jumlah_harga",
}

_NUMBERING_ROW = re.compile(r"^[\d\s,\.]+$")

_KODE_AHSP = re.compile(r"^[A-Z]\.[\d\w\.]+$", re.I)
_REF_CODE = re.compile(
    r"^[LM]\d[\w\.]*$|^[LM]\.\d+[\w\.]*$|^[E]\d[\w\.]*$|^E\.\d+[\w\.]*$|^[M]\d[\w\.]*$|^M\.\d+[\w\.]*$",
    re.I,
)


def _collapse_spaced_letters(text: str) -> str:
    """'U r a i a n' → 'Uraian'."""
    if re.fullmatch(r"([A-Za-zÀ-ÿ]\s+){2,}[A-Za-zÀ-ÿ]", text.strip()):
        return re.sub(r"\s+", "", text)
    return text


def normalize_header(raw: str) -> str:
    """Map messy Docling column names to canonical snake_case keys."""
    text = _collapse_spaced_letters(str(raw))
    text = re.sub(r"\s+", " ", text.strip())
    # Strip duplicate merged headers: "No .No" → "No", "Uraian .Uraian" → "Uraian"
    if "." in text:
        parts = [p.strip() for p in text.split(".") if p.strip()]
        if len(parts) >= 2 and parts[0].lower() == parts[1].lower():
            text = parts[0]
        elif len(parts) == 2 and parts[1].lower().startswith(parts[0].lower()):
            text = parts[0]
    key = text.lower().strip(" .")
    return _HEADER_ALIASES.get(key, re.sub(r"[^\w]+", "_", key).strip("_") or "col")


def clean_cell(value: Any) -> str:
    """Trim whitespace and fix common unit encoding glitches."""
    if value is None:
        return ""
    text = str(value).strip()
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text)
    # Fix m³ written as m3 when used as unit token
    text = re.sub(r"\bm3\b", "m³", text, flags=re.I)
    return text


def is_numbering_row(record: dict[str, str]) -> bool:
    """Detect the '1, 2, 3, 4, 5, 6, 7' column-index row under headers."""
    values = [clean_cell(v) for v in record.values() if clean_cell(v)]
    if len(values) < 4:
        return False
    joined = " ".join(values)
    if not _NUMBERING_ROW.match(joined.replace(" ", "")):
        return False
    nums = [v.strip() for v in values]
    return nums[: min(7, len(nums))] == [str(i) for i in range(1, min(7, len(nums)) + 1)]


def is_jumlah_spam_row(record: dict[str, str]) -> bool:
    """Rows where every cell repeats 'Jumlah Harga …'."""
    values = [clean_cell(v) for v in record.values() if clean_cell(v)]
    if len(values) < 3:
        return False
    lowered = [v.lower() for v in values]
    return all("jumlah harga" in v for v in lowered)


def _is_komponen_header(raw: str) -> bool:
    text = re.sub(r"\s+", " ", _collapse_spaced_letters(str(raw))).strip().lower()
    return text.replace("_", " ") in {"komponen", "komponen 1"}


def remap_columns(columns: list[str]) -> list[str]:
    """Return canonical column keys; disambiguate duplicates with _2, _3."""
    seen: dict[str, int] = {}
    komponen_n = 0
    result: list[str] = []
    for col in columns:
        if _is_komponen_header(col):
            komponen_n += 1
            base = "uraian" if komponen_n == 1 else "kode"
        else:
            base = normalize_header(col)
        count = seen.get(base, 0)
        seen[base] = count + 1
        result.append(base if count == 0 else f"{base}_{count + 1}")
    return result


def clean_records(
    columns: list[str],
    records: list[dict[str, Any]],
    *,
    drop_numbering: bool = True,
    drop_jumlah_spam: bool = False,
) -> tuple[list[str], list[dict[str, str]]]:
    """Normalize columns and cell values; optionally drop junk rows."""
    canon_cols = remap_columns(columns)
    cleaned: list[dict[str, str]] = []

    for record in records:
        row = {canon_cols[i]: clean_cell(record.get(col, "")) for i, col in enumerate(columns)}
        if drop_numbering and is_numbering_row(row):
            continue
        if drop_jumlah_spam and is_jumlah_spam_row(row):
            continue
        cleaned.append(row)

    return canon_cols, cleaned


def clean_table(
    table: dict[str, Any],
    *,
    drop_jumlah_spam: bool = False,
) -> dict[str, Any]:
    """Return a copy of *table* with normalized columns and records."""
    columns, records = clean_records(
        table["columns"],
        table["records"],
        drop_jumlah_spam=drop_jumlah_spam,
    )
    return {
        "index": table["index"],
        "rows": len(records),
        "cols": len(columns),
        "columns": columns,
        "records": records,
        "source_columns": table["columns"],
    }


def parse_id_number(text: str) -> float | None:
    """Parse Indonesian-formatted numbers: '21.428,57' or '0,0173'."""
    text = clean_cell(text)
    if not text or text in {"#", "-", "—"}:
        return None
    if "%" in text:
        return None
    if re.search(r"[A-Za-z]", text):
        return None

    parts = text.split()
    if len(parts) > 1:
        # e.g. "1 1,33" (qty + koef) — prefer last parseable token
        for part in reversed(parts):
            val = _parse_single_id_number(part)
            if val is not None:
                return val
        return None

    return _parse_single_id_number(text.replace(" ", ""))


def _parse_single_id_number(text: str) -> float | None:
    if not text or text in {"#", "-", "—"}:
        return None
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def split_ref_kodes(kode: str) -> list[str]:
    """Split merged ref cells: 'M.25.c M.05.b.3' or normalize 'M . 23'."""
    kode = clean_cell(kode)
    if not kode:
        return []

    found = re.findall(r"[LM]\.\d+[\w\.]*", kode, flags=re.I)
    if len(found) > 1:
        return found

    collapsed = re.sub(r"\s+", "", kode)
    if _REF_CODE.match(collapsed):
        return [collapsed]

    if found:
        return found

    return [kode]


def split_koef_token_strings(text: str) -> list[str]:
    """Raw koef tokens from a cell, preserving Indonesian formatting."""
    text = clean_cell(text)
    if not text:
        return []
    return [part for part in text.split() if _parse_single_id_number(part) is not None]


def split_koef_tokens(text: str) -> list[float]:
    """Parse space-separated koefisien values: '512 0,263'."""
    values: list[float] = []
    for part in split_koef_token_strings(text):
        val = _parse_single_id_number(part)
        if val is not None:
            values.append(val)
    return values
