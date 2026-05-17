#!/usr/bin/env python3
"""
Extract HSD Acuan (Harga Satuan Dasar referensi) dari sheet 'Upah Bahan'
pada SE Bina Konstruksi No. 68/2024.

Output: packages/cipta-karya-2024/data/hsd-acuan.json
Schema: hsd-acuan.schema.json

Struktur sheet:
  I.  UPAH             (rows ~8-50)   → tenaga_kerja[]
  II. MATERIAL         (rows ~51-2069) → bahan[]
  III. SEWA PERALATAN  (rows ~2070-end) → peralatan_sewa[]
"""

import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("pip install openpyxl")

XLSX = "/root/.claude/uploads/64129fc8-b021-484f-b751-749ea0ddfb00/ed24cada-AHSP_CIPTA_KARYA_SE_BINA_KONSTRUKSI_NO_68_TAHUN_2024.xlsx"
OUT = Path(__file__).parent.parent / "packages" / "cipta-karya-2024" / "data" / "hsd-acuan.json"

SUMBER = "SE Bina Konstruksi No. 68/SE/Dk/2024"
TAHUN = 2024


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def is_section_header(row):
    """Detect Roman numeral section header: I., II., III."""
    col3 = clean(row[3]) if len(row) > 3 else None
    if col3 in ("I.", "II.", "III"):
        return True
    return False


def is_subsection_header(row):
    """Detect sub-section like 'MATERIAL TANAH DAN BATUAN'."""
    col5 = clean(row[5]) if len(row) > 5 else None
    if col5 and col5.isupper() and len(col5) > 5 and not any(
        isinstance(row[i], (int, float)) for i in range(6, min(10, len(row)))
    ):
        return True
    return False


def extract(ws):
    rows = list(ws.iter_rows(values_only=True))

    tenaga_kerja = []
    bahan = []
    peralatan = []

    current_section = None   # "upah", "material", "peralatan"
    current_kategori = None

    for row in rows:
        # Pad row to at least 9 columns
        row = list(row) + [None] * max(0, 9 - len(row))

        col3 = clean(row[3])
        col4 = clean(row[4])  # Kode (L.xx)
        col5 = clean(row[5])  # Nama
        col6 = clean(row[6])  # Satuan
        col7 = row[7]         # Harga (numeric)

        # Detect section transitions
        if col3 in ("I.", "II.", "III"):
            if col5 == "UPAH":
                current_section = "upah"
                current_kategori = None
            elif col5 == "MATERIAL":
                current_section = "material"
                current_kategori = None
            elif col5 == "SEWA PERALATAN":
                current_section = "peralatan"
                current_kategori = None
            continue

        if current_section is None:
            continue

        # Detect subsection headers (all-caps, no numeric price)
        if (col5 and col5.replace(" ", "").replace("-", "").isupper()
                and len(col5) > 5
                and (col7 is None or not isinstance(col7, (int, float)))):
            current_kategori = col5.strip()
            continue

        # Validate: need a name and a positive price
        nama = col5
        if not nama:
            continue
        # Skip formula errors
        if nama.startswith("#"):
            continue
        # Skip pure headers
        if nama.upper() in ("UPAH - MATERIAL - ALAT", "NO", "UPAH", "MATERIAL", "SEWA PERALATAN",
                             "KETERANGAN", "HARGA SATUAN", "LAIN-LAIN"):
            continue

        satuan = clean(col6) or "unit"
        harga = col7
        if harga is None or not isinstance(harga, (int, float)) or harga <= 0:
            continue
        harga = round(float(harga), 2)

        if current_section == "upah":
            # L.xx code in col4
            ref = col4 if col4 and re.match(r'^L\.', col4) else None
            entry = {"nama": nama, "satuan": satuan, "harga_rp": harga}
            if ref:
                entry = {"ref": ref, **entry}
            # Avoid duplicates: same ref+nama already added
            existing = [(t.get("ref"), t["nama"]) for t in tenaga_kerja]
            if (ref, nama) not in existing:
                tenaga_kerja.append(entry)

        elif current_section == "material":
            entry = {"nama": nama, "satuan": satuan, "harga_rp": harga}
            if current_kategori:
                entry = {"kategori": current_kategori, **entry}
            bahan.append(entry)

        elif current_section == "peralatan":
            catatan = clean(row[8]) if len(row) > 8 else None
            entry = {"nama": nama, "satuan": satuan, "harga_rp": harga}
            if catatan:
                entry["catatan"] = catatan
            peralatan.append(entry)

    return tenaga_kerja, bahan, peralatan


def main():
    print(f"Loading {XLSX}")
    import openpyxl
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb["Upah Bahan"]

    tk, bahan, peralatan = extract(ws)

    print(f"  Tenaga kerja : {len(tk)} entries")
    print(f"  Bahan        : {len(bahan)} entries")
    print(f"  Peralatan    : {len(peralatan)} entries")

    data = {
        "version": "2024.0.0",
        "sumber_regulasi": SUMBER,
        "tahun": TAHUN,
        "tenaga_kerja": tk,
        "bahan": bahan,
        "peralatan_sewa": peralatan,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nWritten: {OUT.relative_to(Path(__file__).parent.parent)}")


if __name__ == "__main__":
    main()
