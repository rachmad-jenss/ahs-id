#!/usr/bin/env python3
"""
Extract AHSP dan HSD data dari sheet 'Lansekap' pada SE Bina Konstruksi No. 68/2024.

Outputs:
  1. packages/cipta-karya-2024/data/ahsp/divisi-6/lansekap.json
     — 85 AHSP items (fixed_coefficient) untuk pekerjaan penanaman & pemeliharaan taman

  2. Menambahkan 5 entri HSD derivasi ke packages/cipta-karya-2024/data/hsd-acuan.json
     — Pohon Kecil (Polybag 25L), Pohon Sedang (Polybag 50L), Pohon Besar (Polybag 100L),
       Pohon Besar dengan Crane, Sewa Water Truck untuk Penyiraman

Sheet layout (AHSP items 4.1.2.x+):
  col[2] = Nomor / kode AHSP
  col[3] = Uraian (nama)
  col[4] = Satuan
  col[5] = Koefisien
  col[6] = Harga Satuan (Rp)
  col[7] = Jumlah Harga (Rp)
  col[8] = Harga Satuan Pekerjaan (header row only)

HSD items (4.1.1.x):
  col[2] = kode (4.1.1.1 ... 4.1.1.5)
  col[3] = Nama lengkap HSD
  col[10] = Final derived HSD value (Rp, rounded)
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
ROOT = Path(__file__).parent.parent
OUT_AHSP = ROOT / "packages" / "cipta-karya-2024" / "data" / "ahsp" / "divisi-6" / "lansekap.json"
OUT_HSD = ROOT / "packages" / "cipta-karya-2024" / "data" / "hsd-acuan.json"

SUMBER = "SE Bina Konstruksi No. 68/SE/Dk/2024"

STANDARD_MARGIN = {
    "overhead_pct": {"label": "Biaya Umum (Overhead)", "min": 0, "max": 15, "default": 10},
    "profit_pct": {"label": "Keuntungan (Profit)", "min": 0, "max": 15, "default": 5},
    "constraint": {"rule": "10 <= overhead_pct + profit_pct <= 15"},
}

TK_CODES = {
    "Pekerja": "L.01",
    "Tukang batu": "L.02", "Tukang kayu": "L.02", "Tukang besi": "L.02",
    "Tukang cat": "L.02", "Tukang pipa": "L.02", "Tukang las": "L.02",
    "Tukang listrik": "L.02", "Tukang alumunium": "L.02", "Tukang kaca": "L.02",
    "Tukang erection": "L.02", "Tukang tanam": "L.02", "Tukang pelitur": "L.02",
    "Tukang pemelihara taman": "L.02",
    "Kepala tukang": "L.03",
    "Mandor": "L.04",
    "Juru ukur": "L.05",
    "Sopir": "L.10",
    "Kenek": "L.11",
}


def clean(v):
    if v is None:
        return None
    return str(v).strip()


def is_kode_ahsp(v):
    if v is None:
        return False
    s = str(v).strip()
    return bool(re.match(r'^\d+\.\d+', s)) and not s.startswith('0')


def get_section_type(val):
    if val is None:
        return None
    s = str(val).strip().upper()
    if s in ("A", "TENAGA KERJA"):
        return "tk"
    if s in ("B", "BAHAN", "MATERIAL"):
        return "bahan"
    if s in ("C", "PERALATAN", "ALAT"):
        return "peralatan"
    if s in ("D", "E", "F") or "JUMLAH" in s or "BIAYA UMUM" in s or "HARGA SATUAN PEKERJAAN" in s:
        return "end"
    return None


def infer_satuan(nama: str) -> str:
    name_lower = nama.lower()
    m = re.search(r'\b(m3|m2|m\'|m1|m|kg|buah|btg|set|ls|ha|tgl|hari|jam|unit|lbr|bh|titik)\b', name_lower)
    return m.group(1) if m else "unit"


def extract_hsd_items(rows: list) -> list:
    """Extract the 5 HSD derivation items from the top of the sheet."""
    hsd_entries = []
    satuan_map = {
        "4.1.1.1": "buah",
        "4.1.1.2": "buah",
        "4.1.1.3": "buah",
        "4.1.1.4": "polybag",
        "4.1.1.5": "hari",
    }
    for row in rows:
        col2 = clean(row[2])
        col3 = clean(row[3])
        col10 = row[10]
        if not col2 or not re.match(r'^4\.1\.1\.\d+$', col2):
            continue
        if col10 is None or not isinstance(col10, (int, float)) or col10 <= 0:
            continue
        satuan = satuan_map.get(col2, "buah")
        # Shorten "Harga Satuan Dasar ..." prefix to just the descriptive part
        nama = col3 or col2
        hsd_entries.append({
            "kategori": "Tanaman dan Lansekap",
            "nama": nama,
            "satuan": satuan,
            "harga_rp": round(float(col10), 2),
        })
    return hsd_entries


def extract_ahsp_items(rows: list) -> list:
    """Extract regular AHSP items (4.1.2.x+) from the Lansekap sheet."""
    items = []
    current_item = None
    current_section = None

    for row in rows:
        # Ensure enough columns
        while len(row) < 10:
            row = tuple(row) + (None,)

        col2 = clean(row[2])
        col3 = clean(row[3])

        # New AHSP item detected
        if is_kode_ahsp(col2):
            # Save previous
            if current_item is not None:
                items.append(current_item)

            # Skip HSD derivation items (4.1.1.x) — these go into hsd-acuan
            kode = col2.strip()
            parts = kode.split(".")
            sub_divisi = f"{parts[0]}.{parts[1]}" if len(parts) >= 2 else kode

            if len(parts) >= 3 and parts[2] == "1" and len(parts) == 4 and parts[3] in ("1","2","3","4","5"):
                # e.g. 4.1.1.x
                if f"{parts[0]}.{parts[1]}.{parts[2]}" == "4.1.1":
                    current_item = None
                    current_section = None
                    continue

            # Also skip subsection headers like "4.1.2" (no price, no components)
            # The post-processing filter will handle this

            # Find final price: col[8] is Harga Satuan Pekerjaan in AHSP item headers
            final_price = None
            # col[8] is the AHSP total price column in Lansekap
            v8 = row[8] if len(row) > 8 else None
            if isinstance(v8, (int, float)) and v8 > 0:
                final_price = round(float(v8))
            else:
                # Fallback: scan rightmost positive numeric
                for ci in range(len(row) - 1, 4, -1):
                    v = row[ci]
                    if isinstance(v, (int, float)) and v > 0:
                        final_price = round(float(v))
                        break

            nama = col3 or ""
            jp = "manual"
            nl = nama.lower()
            if "mesin" in nl or "semi mekanis" in nl:
                jp = "semi-mekanis"
            elif "mekanis" in nl and "semi" not in nl:
                jp = "mekanis"

            current_item = {
                "kode_ahsp": kode,
                "nama": nama,
                "bidang": "cipta-karya",
                "divisi": int(parts[0]) if parts[0].isdigit() else 6,
                "sub_divisi": sub_divisi,
                "satuan_bayar": infer_satuan(nama),
                "jenis_kalkulasi": "fixed_coefficient",
                "jenis_pekerjaan": jp,
                "is_lump_sum": False,
                "tenaga_kerja": [],
                "bahan": [],
                "peralatan": [],
                "harga_satuan_pekerjaan_ref": final_price,
                "margin": STANDARD_MARGIN,
                "provenance": {
                    "sumber_regulasi": SUMBER,
                    "halaman": "Lansekap",
                    "diverifikasi_oleh": None,
                    "tanggal_verifikasi": None,
                },
            }
            current_section = None
            continue

        # Section header detection
        if current_item is not None and col2:
            st = get_section_type(col2)
            if st in ("tk", "bahan", "peralatan"):
                current_section = st
                continue
            elif st == "end":
                continue

        # Component row parsing
        if current_item is None or current_section is None:
            continue

        # Skip JUMLAH / header lines by uraian
        uraian = col3
        if not uraian:
            continue
        if uraian.upper() in ("JUMLAH HARGA TENAGA KERJA", "JUMLAH HARGA BAHAN",
                              "JUMLAH HARGA ALAT", "JUMLAH HARGA PERALATAN",
                              "CATATAN:", "URAIAN"):
            continue
        if uraian.lower() in ("no",):
            continue

        satuan = clean(row[4]) if len(row) > 4 else None
        koef_raw = row[5] if len(row) > 5 else None
        harga_raw = row[6] if len(row) > 6 else None

        # Some rows are sub-group labels (no koef/harga) — skip
        if koef_raw is None or not isinstance(koef_raw, (int, float)) or float(koef_raw) <= 0:
            continue
        if harga_raw is None or not isinstance(harga_raw, (int, float)):
            continue

        koef = float(koef_raw)
        harga = float(harga_raw)

        if current_section == "tk":
            entry = {
                "nama": uraian,
                "satuan": satuan or "OH",
                "koefisien": round(koef, 6),
                "harga_satuan_ref": round(harga),
            }
            ref = TK_CODES.get(uraian)
            if ref:
                entry["ref"] = ref
            else:
                entry["ref"] = None
            current_item["tenaga_kerja"].append(entry)

        elif current_section == "bahan":
            entry = {
                "nama": uraian,
                "satuan": satuan or "",
                "koefisien": round(koef, 6),
                "harga_satuan_ref": round(harga),
            }
            current_item["bahan"].append(entry)

        elif current_section == "peralatan":
            entry = {
                "nama": uraian,
                "satuan": satuan or "",
                "koefisien": round(koef, 6),
                "harga_satuan_ref": round(harga),
            }
            current_item["peralatan"].append(entry)

    # Append last item
    if current_item is not None:
        items.append(current_item)

    # Filter: remove subsection headers (no price + no components)
    items = [
        item for item in items
        if item.get("harga_satuan_pekerjaan_ref") or item["tenaga_kerja"] or item["bahan"] or item["peralatan"]
    ]

    return items


def main():
    print(f"Loading {XLSX}")
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb["Lansekap"]
    rows = list(ws.iter_rows(values_only=True))

    # --- 1. Extract HSD items ---
    hsd_entries = extract_hsd_items(rows)
    print(f"\nHSD derivasi items: {len(hsd_entries)}")
    for e in hsd_entries:
        print(f"  {e['nama'][:60]} → {e['harga_rp']:,.0f} Rp/{e['satuan']}")

    # Append to hsd-acuan.json
    with open(OUT_HSD, "r", encoding="utf-8") as f:
        hsd_acuan = json.load(f)

    # Remove any previously extracted lansekap entries to allow re-run
    existing = hsd_acuan.get("bahan", [])
    existing = [b for b in existing if b.get("kategori") != "Tanaman dan Lansekap"]
    hsd_acuan["bahan"] = existing + hsd_entries

    with open(OUT_HSD, "w", encoding="utf-8") as f:
        json.dump(hsd_acuan, f, ensure_ascii=False, indent=2)
    print(f"\nUpdated: {OUT_HSD.relative_to(ROOT)}")
    print(f"  Total bahan in hsd-acuan: {len(hsd_acuan['bahan'])}")

    # --- 2. Extract AHSP items ---
    ahsp_items = extract_ahsp_items(rows)
    print(f"\nAHSP items (Lansekap): {len(ahsp_items)}")

    # Spot-check
    for item in ahsp_items[:3]:
        print(f"  {item['kode_ahsp']:12s} {item['nama'][:50]:50s} {item['satuan_bayar']:6s} {item['harga_satuan_pekerjaan_ref']}")

    OUT_AHSP.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_AHSP, "w", encoding="utf-8") as f:
        json.dump(ahsp_items, f, ensure_ascii=False, indent=2)
    print(f"\nWritten: {OUT_AHSP.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
