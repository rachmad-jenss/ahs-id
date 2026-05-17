#!/usr/bin/env python3
"""
Extraction script for AHSP data from Permen PUPR No. 1 Tahun 2022.
Reads the Excel file and produces JSON data files for the bina-marga-2022 package.

Usage:
    python3 scripts/extract-bina-marga-2022.py

Output:
    packages/bina-marga-2022/data/ahsp/divisi-{N}/items.json
    packages/bina-marga-2022/data/tenaga-kerja.json
    packages/bina-marga-2022/data/bahan-master.json
"""

import json
import os
import re
import sys
from pathlib import Path

try:
    import xlrd
except ImportError:
    print("ERROR: xlrd not installed. Run: pip install xlrd", file=sys.stderr)
    sys.exit(1)

XLS_PATH = "/root/.claude/uploads/dedfdd4f-fb4f-455d-a905-c103a26114d8/df3473c7-AHSP_BINA_MARGA__PERMEN_PUPR_NOMOR_1_TAHUN_2022.xls"
OUTPUT_BASE = Path(__file__).parent.parent / "packages" / "bina-marga-2022" / "data"

SUMBER_REGULASI = "Permen PUPR 1/2022"

# ─── helpers ────────────────────────────────────────────────────────────────

def cell_str(sheet, row, col):
    try:
        return str(sheet.cell_value(row, col)).strip()
    except Exception:
        return ""

def cell_float(sheet, row, col):
    try:
        v = sheet.cell_value(row, col)
        if isinstance(v, (int, float)) and v != 0:
            return float(v)
        return None
    except Exception:
        return None

def normalize_kode_ahsp(raw: str) -> str:
    """Normalize item kode: '2.1.(1)' → '2.1.(1)' (keep as-is but clean)"""
    kode = raw.strip().lstrip(':').strip()
    # Remove leading colon-space patterns
    kode = re.sub(r'^[:\s]+', '', kode)
    return kode

def kode_to_divisi(kode: str) -> int:
    """Extract divisi number from kode like '2.1.(1)' → 2"""
    m = re.match(r'^(\d+)', kode)
    if m:
        return int(m.group(1))
    return 0

def normalize_ref(code_str: str) -> str:
    """(E10a) → E10a, (L01) → L01, (M02) → M02"""
    return re.sub(r'[()]', '', code_str.strip())

def build_margin():
    return {
        "overhead_pct": {"label": "Biaya Umum (Overhead)", "min": 0, "max": 15, "default": 10},
        "profit_pct": {"label": "Keuntungan (Profit)", "min": 0, "max": 15, "default": 5},
        "constraint": {"rule": "10 <= overhead_pct + profit_pct <= 15"}
    }

def build_provenance(sheet_name: str):
    return {
        "sumber_regulasi": SUMBER_REGULASI,
        "halaman": sheet_name,
        "diverifikasi_oleh": None,
        "tanggal_verifikasi": None
    }

# ─── BOQ extraction ─────────────────────────────────────────────────────────

def extract_boq(wb) -> dict:
    """Returns dict: kode → {nama, satuan, hsp}"""
    sheet = wb.sheet_by_name('1-BOQ')
    boq = {}
    for i in range(sheet.nrows):
        kode = cell_str(sheet, i, 0)
        nama = cell_str(sheet, i, 2)
        satuan = cell_str(sheet, i, 3)
        try:
            hsp = sheet.cell_value(i, 5)
            hsp = float(hsp) if isinstance(hsp, (int, float)) else None
        except Exception:
            hsp = None

        # Valid kode looks like 2.1.(1), 3.1.(2a), etc.
        if (kode and re.match(r'^\d+\.\d+', kode) and nama
                and nama not in ('Uraian', 'U R A I A N')):
            boq[kode] = {
                'nama': nama,
                'satuan': satuan.strip(),
                'hsp': hsp
            }
    return boq

# ─── Tenaga Kerja extraction ─────────────────────────────────────────────────

def extract_tenaga_kerja(wb) -> list:
    sheet = wb.sheet_by_name('4-Basic Price')
    items = []
    for i in range(sheet.nrows):
        kode_raw = cell_str(sheet, i, 3)
        nama = cell_str(sheet, i, 1) or cell_str(sheet, i, 2)
        satuan = cell_str(sheet, i, 4)
        harga_jam_raw = sheet.cell_value(i, 5) if sheet.ncols > 5 else None

        if not kode_raw.startswith('(L'):
            continue
        # Only use Jam rows; skip OB (orang bulan) duplicate rows further down the sheet
        if satuan.upper() not in ('JAM', 'JM', ''):
            continue

        kode = normalize_ref(kode_raw)
        if not kode:
            continue

        harga_jam = float(harga_jam_raw) if isinstance(harga_jam_raw, (int, float)) and harga_jam_raw else None

        items.append({
            "kode": kode,
            "nama": nama,
            "satuan": "OH",
            "satuan_sumber": satuan,
            "harga_jam": harga_jam,
            "jam_efektif": 7
        })
    return items

# ─── Peralatan HSD extraction ────────────────────────────────────────────────

def extract_peralatan_hsd(wb) -> list:
    """Extract HSD per Jam (total biaya sewa) for each equipment from 5-Alat sheets."""
    result = []
    for sname in wb.sheet_names():
        if not sname.startswith('5-Alat'):
            continue
        sheet = wb.sheet_by_name(sname)
        current_code = None
        current_nama = None
        for i in range(sheet.nrows):
            row = [cell_str(sheet, i, c) for c in range(min(sheet.ncols, 12))]
            # Equipment definition row: no.='1.' and 'Jenis Peralatan' in col[2] and code in col[9]
            if row[0] in ('1.', '1') and 'Jenis Peralatan' in row[2] and row[9]:
                current_code = row[9].strip()
                current_nama = row[6].strip()  # equipment name in col[6]
            # Total HSD row
            if 'TOTAL BIAYA SEWA' in row[2] and current_code:
                hsd_val = cell_float(sheet, i, 7)
                if hsd_val and hsd_val > 0:
                    result.append({
                        "kode": current_code,
                        "nama": current_nama or current_code,
                        "hsd_rp_per_jam": round(hsd_val, 2),
                        "sumber_sheet": sname,
                    })
                current_code = None
    return result


# ─── Bahan Master extraction ─────────────────────────────────────────────────

def extract_bahan_master(wb) -> list:
    sheet = wb.sheet_by_name('4-Basic Price')
    items = []
    in_bahan_section = False
    for i in range(sheet.nrows):
        c0 = cell_str(sheet, i, 0)
        if 'HARGA DASAR SATUAN BAHAN' in c0 or 'DAFTAR' in c0:
            in_bahan_section = True
            continue

        if not in_bahan_section:
            continue

        kode_raw = cell_str(sheet, i, 3)
        nama = cell_str(sheet, i, 2) or cell_str(sheet, i, 1)
        satuan = cell_str(sheet, i, 4)
        harga_raw = sheet.cell_value(i, 5) if sheet.ncols > 5 else None

        # Valid bahan code: M01, M01a, M01b, etc.
        if not re.match(r'^M\d+', kode_raw):
            continue
        if not nama:
            continue

        harga = float(harga_raw) if isinstance(harga_raw, (int, float)) and harga_raw else None

        items.append({
            "kode": kode_raw,
            "nama": nama,
            "satuan": satuan,
            "harga": harga
        })
    return items

# ─── D-sheet item extraction ──────────────────────────────────────────────────

# Pattern to detect equipment codes like (E10a), (E01), E68 (with or without parens)
RE_EQUIP = re.compile(r'^\(?E[0-9I]\w*\)?$', re.IGNORECASE)
# Labor codes are L01–L25 (always 2-digit) — single-digit L1/L2 are length/lane variables
RE_LABOR = re.compile(r'^\(?L\d{2,}\)?$', re.IGNORECASE)
# Pattern to detect bahan codes like (M01), (M12), M01 (with or without parens)
RE_BAHAN = re.compile(r'^\(?M\d+[a-z]?\)?$', re.IGNORECASE)


def parse_d_sheet(wb, sheet_name: str, boq: dict) -> list:
    """Parse a D-sheet and extract all AHSP items."""
    sheet = wb.sheet_by_name(sheet_name)
    nrows = sheet.nrows

    # Find all item header rows (first occurrence of each kode)
    item_starts = []  # list of (row_idx, kode)
    seen_kodes = set()

    for i in range(nrows):
        c0 = cell_str(sheet, i, 0)
        if 'ITEM PEMBAYARAN' in c0:
            kode_raw = cell_str(sheet, i, 3)
            kode = normalize_kode_ahsp(kode_raw)
            if kode and kode not in seen_kodes and re.match(r'^\d+\.\d+', kode):
                seen_kodes.add(kode)
                item_starts.append((i, kode))

    items = []
    for idx, (start_row, kode) in enumerate(item_starts):
        # Determine end row: next item start or end of sheet
        end_row = item_starts[idx + 1][0] if idx + 1 < len(item_starts) else nrows

        item = extract_item(sheet, start_row, end_row, kode, sheet_name, boq)
        if item:
            items.append(item)

    return items


def extract_item(sheet, start_row: int, end_row: int, kode: str, sheet_name: str, boq: dict) -> dict | None:
    """Extract a single AHSP item from rows start_row..end_row."""
    nrows = sheet.nrows

    # Collect basic info from header
    nama = ""
    satuan_bayar = ""
    hsp_value = None
    tk_jam = 7.0  # default jam kerja efektif
    fa = 0.83  # default faktor efisiensi
    jarak_km = None

    # First pass: header rows (start_row..start_row+5)
    for i in range(start_row, min(start_row + 10, end_row)):
        c0 = cell_str(sheet, i, 0)
        c3 = cell_str(sheet, i, 3)
        if 'JENIS PEKERJAAN' in c0:
            nama = c3.lstrip(':').strip()
        elif 'SATUAN PEMBAYARAN' in c0:
            satuan_bayar = c3.lstrip(':').strip()

    if not nama:
        boq_entry = boq.get(kode, {})
        nama = boq_entry.get('nama', kode)

    if not satuan_bayar:
        boq_entry = boq.get(kode, {})
        satuan_bayar = boq_entry.get('satuan', '')

    # Normalize satuan
    satuan_bayar = normalize_satuan(satuan_bayar)

    # Second pass: scan all rows for data
    peralatan_dict: dict[str, dict] = {}  # ref → item
    tenaga_dict: dict[str, dict] = {}     # ref → item
    bahan_list: list[dict] = []
    catatan_umum: list[str] = []
    sub_ahsp: list[dict] = []

    # Collect rows from both the first AND second page (duplicated header)
    # We scan all rows between start_row and end_row
    for i in range(start_row, min(end_row, nrows)):
        c0 = cell_str(sheet, i, 0)
        c2 = cell_str(sheet, i, 2)
        c3 = cell_str(sheet, i, 3)
        c6 = cell_str(sheet, i, 6)
        c7_raw = sheet.cell_value(i, 7) if sheet.ncols > 7 else ""
        c7 = str(c7_raw).strip() if c7_raw != "" else ""
        c8 = cell_str(sheet, i, 8)

        # Jam kerja efektif
        if c6 == 'Tk':
            try:
                tk_jam = float(c7_raw)
            except Exception:
                tk_jam = 7.0

        # Faktor efisiensi
        if c6 in ('Fa', 'fa') and isinstance(c7_raw, (int, float)) and c7_raw:
            fa = float(c7_raw)

        # Jarak
        if c6 == 'L' and isinstance(c7_raw, (int, float)) and c7_raw:
            jarak_km = float(c7_raw)

        # HSP row: col[2] contains 'Rp.' or starts with 'Rp'
        if c2.startswith('Rp'):
            try:
                hsp_value = float(c3)
            except Exception:
                pass

        # Equipment koefisien: col[6] matches (E##) pattern and col[2] contains "Koefisien"
        if RE_EQUIP.match(c6) and ('Koefisien' in c2 or 'koefisien' in c2):
            ref = normalize_ref(c6)
            koef = None
            try:
                koef = float(c7_raw)
            except Exception:
                pass
            if koef is not None and koef > 0 and ref:
                if ref not in peralatan_dict:
                    peralatan_dict[ref] = {
                        "ref": ref,
                        "nama": ref,  # will be filled later
                        "koef_sumber": "kalkulasi",
                        "mode_biaya": "ownership",
                        "volume_state": None,
                        "variabel_input": [],
                        "koef_referensi": {
                            "value": round(koef, 10),
                            "asumsi": {
                                "fa": fa,
                                **({"jarak_km": jarak_km} if jarak_km else {}),
                                "jam_kerja": tk_jam
                            }
                        },
                        "catatan": f"Satuan: {c8}" if c8 else None
                    }

        # Labor koefisien: col[6] matches (L##) and col[7] is float and col[8] in Jam/OH/jam
        if RE_LABOR.match(c6):
            koef = None
            try:
                koef = float(c7_raw)
            except Exception:
                pass
            if koef is not None and koef > 0:
                ref = normalize_ref(c6)
                satuan_koef = c8.lower() if c8 else ''
                # Convert from Jam to OH: divide by tk_jam
                if 'jam' in satuan_koef:
                    koef_oh = koef / tk_jam
                else:
                    koef_oh = koef  # already OH

                if ref not in tenaga_dict:
                    tenaga_dict[ref] = {
                        "ref": ref,
                        "koefisien": round(koef_oh, 10),
                        "koef_sumber": "kalkulasi",
                        "catatan": f"Sumber: {round(koef, 6)} Jam/{satuan_bayar or 'sat'} ÷ {tk_jam} jam/OH" if 'jam' in satuan_koef else None
                    }

        # Bahan koefisien
        if RE_BAHAN.match(c6):
            koef = None
            try:
                koef = float(c7_raw)
            except Exception:
                pass
            if koef is not None:
                ref = normalize_ref(c6)
                # Only add if not already present
                if not any(b['ref'] == ref for b in bahan_list):
                    bahan_list.append({
                        "ref": ref,
                        "koefisien": round(koef, 10),
                        "koef_sumber": "kalkulasi",
                        "volume_state": None,
                        "catatan": f"Satuan: {c8}" if c8 else None
                    })

        # Sub-AHSP references (e.g. (EI-716), (EI-241))
        if re.match(r'^\(EI-', c6):
            koef = None
            try:
                koef = float(c7_raw)
            except Exception:
                pass
            ref_raw = normalize_ref(c6)
            if koef is not None and c2:
                sub_ahsp.append({
                    "ref": ref_raw,
                    "koefisien": round(koef, 10),
                    "satuan": c8,
                    "catatan": c2[:120]
                })
                catatan_umum.append(f"Sub-item {ref_raw}: {c2[:80]} = {round(koef, 6)} {c8}")

    # Fill equipment names from sheet context (best effort: use ref as name)
    peralatan_list = []
    for ref, eq in sorted(peralatan_dict.items()):
        eq_final = dict(eq)
        eq_final['nama'] = get_equipment_name(ref)
        peralatan_list.append(eq_final)

    tenaga_list = [v for v in tenaga_dict.values()]

    # Normalize kode_ahsp
    kode_ahsp = kode

    divisi = kode_to_divisi(kode_ahsp)

    # Build sub_divisi from kode like '2.1.(1)' → '2.1'
    m = re.match(r'^(\d+\.\d+)', kode_ahsp)
    sub_divisi = m.group(1) if m else str(divisi)

    item = {
        "kode_ahsp": kode_ahsp,
        "nama": nama,
        "bidang": "bina-marga",
        "divisi": divisi,
        "sub_divisi": sub_divisi,
        "satuan_bayar": satuan_bayar,
        "volume_state_bayar": "bank",
        "jenis_pekerjaan": "mekanis",
        "is_lump_sum": satuan_bayar.upper() == "LS",
        "sub_ahsp": sub_ahsp,
        "tenaga_kerja": tenaga_list,
        "bahan": bahan_list,
        "peralatan": peralatan_list,
        "variabel": {},
        "margin": build_margin(),
        "provenance": build_provenance(sheet_name),
        "catatan_umum": catatan_umum
    }

    if hsp_value is not None:
        item["hsp_referensi"] = round(hsp_value, 2)

    return item


def normalize_satuan(raw: str) -> str:
    """Normalize satuan strings."""
    s = raw.strip().lstrip(':').strip()
    mapping = {
        "M3": "m3", "M2": "m2", "M1": "m1", "M'": "m1", "M": "m",
        "KG": "kg", "Kg": "kg", "TON": "ton", "Ton": "ton",
        "LTR": "liter", "LITER": "liter", "Liter": "liter", "Ltr": "liter",
        "BH": "bh", "Bh": "bh", "BUAH": "buah", "Buah": "buah",
        "LS": "LS", "UNIT": "unit", "Unit": "unit",
        "ZAK": "zak", "Zak": "zak", "SET": "set", "Set": "set",
    }
    return mapping.get(s, s.lower() if s else "")


EQUIPMENT_NAMES = {
    # Excavators
    "E01": "Excavator PC-200", "E01a": "Excavator PC-200",
    "E02": "Excavator PC-100", "E02a": "Excavator PC-100",
    "E03": "Excavator PC-300", "E03a": "Excavator PC-300 (Long Arm)",
    "E04": "Excavator PC-75 (Amphibious)",
    "E05": "Bulldozer 100 HP",
    "E06": "Concrete Mixer 0.3-0.6 M3",
    "E07": "Concrete Vibrator",
    "E08": "Dump Truck 4 Ton",
    "E09": "Dump Truck 10 Ton",
    "E10": "Excavator PC-200", "E10a": "Mini Excavator",
    "E11": "Flat Bed Truck 3-4 Ton",
    "E12": "Motor Grader > 100 HP",
    "E13": "Tandem Roller 6-8 T",
    "E14": "Tire Roller 8-10 T",
    "E15": "Vibratory Roller 5-8 T",
    "E16": "Asphalt Finisher",
    "E17": "Asphalt Mixing Plant",
    "E18": "Asphalt Distributor 4000 L",
    "E19": "Compressor 4000-6500 L/M",
    "E20": "Concrete Pump",
    "E21": "Water Pump 70-100 mm",
    "E22": "Crane Truck",
    "E23": "Truck Crane 25 Ton",
    "E24": "Jack Hammer",
    "E25": "Tamper (Compactor)",
    "E26": "Generator Set",
    "E27": "Track Loader",
    "E28": "Crawler Crane",
    "E29": "Pile Driver + Hammer",
    "E30": "Hydraulic Static Pile Driver",
    "E31": "Backhoe Loader",
    "E32": "Crane On Truck 25 T",
    "E33": "Vibro Hammer",
    "E34": "Boring Machine",
    "E35": "Concrete Pan Mixer",
    "E36": "Truck Mixer (Agitator)",
    "E37": "Concrete Spreader",
    "E38": "Tire Roller 12-14 T",
    "E39": "Light Roller (Baby Roller)",
    "E40": "Screed Machine",
    "E41": "Texture & Curing Machine",
    "E42": "Diamond Grinding Machine",
    "E43": "Dowel Bar Inserter",
    "E44": "Concrete Saw",
    "E45": "Pavement Joint Sealer",
    "E46": "Water Tank Truck 5000 L",
}


def get_equipment_name(ref: str) -> str:
    return EQUIPMENT_NAMES.get(ref, f"Peralatan {ref}")


def extract_pekerjaan_harian(boq: dict) -> list:
    """Extract 9.1.x Pekerjaan Harian items from BOQ index.

    These items (labor/equipment hourly rates) don't have standard AHSP koefisien.
    They're unit prices per Jam with is_lump_sum=False and empty components.
    """
    items = []
    for kode, entry in boq.items():
        if not kode.startswith('9.1.'):
            continue
        m = re.match(r'^(\d+\.\d+)', kode)
        sub_divisi = m.group(1) if m else '9.1'
        item = {
            "kode_ahsp": kode,
            "nama": entry['nama'],
            "bidang": "bina-marga",
            "divisi": 9,
            "sub_divisi": sub_divisi,
            "satuan_bayar": normalize_satuan(entry.get('satuan', 'jam')),
            "volume_state_bayar": "bank",
            "jenis_pekerjaan": "manual",
            "is_lump_sum": False,
            "sub_ahsp": [],
            "tenaga_kerja": [],
            "bahan": [],
            "peralatan": [],
            "variabel": {},
            "margin": build_margin(),
            "provenance": build_provenance("D9(1)"),
            "catatan_umum": ["Item Pekerjaan Harian — harga satuan per Jam langsung dari HSD/upah"],
        }
        if entry.get('hsp') and entry['hsp'] > 0:
            item["hsp_referensi"] = round(entry['hsp'], 2)
        items.append(item)
    return items


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"Reading: {XLS_PATH}")
    wb = xlrd.open_workbook(XLS_PATH)

    # Extract reference data
    print("Extracting BOQ index...")
    boq = extract_boq(wb)
    print(f"  → {len(boq)} BOQ items")

    print("Extracting tenaga kerja...")
    tenaga_kerja_items = extract_tenaga_kerja(wb)
    print(f"  → {len(tenaga_kerja_items)} labor codes")

    print("Extracting bahan master...")
    bahan_master_items = extract_bahan_master(wb)
    print(f"  → {len(bahan_master_items)} bahan codes")

    print("Extracting peralatan HSD (biaya sewa per jam)...")
    peralatan_hsd_items = extract_peralatan_hsd(wb)
    print(f"  → {len(peralatan_hsd_items)} equipment HSD values")

    # D-sheets to process (skip D1 — project-specific)
    # D9(1) has Pekerjaan Harian format (9.1.x) — different structure, use BOQ-only extraction
    d_sheets_normal = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7(1)', 'D7(2)', 'D8', 'D9(2)', 'D10']
    all_items: list[dict] = []

    for sheet_name in d_sheets_normal:
        if sheet_name not in wb.sheet_names():
            print(f"  WARNING: Sheet {sheet_name} not found, skipping")
            continue
        print(f"Parsing {sheet_name}...")
        items = parse_d_sheet(wb, sheet_name, boq)
        print(f"  → {len(items)} items")
        all_items.extend(items)

    # D9(1): Pekerjaan Harian (9.1.x) — unit rates per Jam for labor/equipment
    # These items don't have traditional AHSP koefisien structure; create from BOQ only
    print("Parsing D9(1) (Pekerjaan Harian — BOQ-only)...")
    d9_harian = extract_pekerjaan_harian(boq)
    print(f"  → {len(d9_harian)} pekerjaan harian items")
    all_items.extend(d9_harian)

    print(f"\nTotal items extracted: {len(all_items)}")

    # Group by divisi
    by_divisi: dict[int, list] = {}
    for item in all_items:
        d = item['divisi']
        by_divisi.setdefault(d, []).append(item)

    # Write output files
    OUTPUT_BASE.mkdir(parents=True, exist_ok=True)

    # Write tenaga-kerja.json
    tk_path = OUTPUT_BASE / "tenaga-kerja.json"
    tk_data = {
        "version": "1.0.0",
        "sumber": SUMBER_REGULASI,
        "items": tenaga_kerja_items
    }
    tk_path.write_text(json.dumps(tk_data, ensure_ascii=False, indent=2))
    print(f"\nWritten: {tk_path}")

    # Write bahan-master.json
    bahan_path = OUTPUT_BASE / "bahan-master.json"
    bahan_data = {
        "version": "1.0.0",
        "sumber": SUMBER_REGULASI,
        "items": bahan_master_items
    }
    bahan_path.write_text(json.dumps(bahan_data, ensure_ascii=False, indent=2))
    print(f"Written: {bahan_path}")

    # Write peralatan-hsd.json
    hsd_path = OUTPUT_BASE / "peralatan-hsd.json"
    hsd_data = {
        "version": "1.0.0",
        "sumber": SUMBER_REGULASI,
        "catatan": "HSD = total biaya sewa alat per jam (biaya pasti + biaya operasi)",
        "items": peralatan_hsd_items
    }
    hsd_path.write_text(json.dumps(hsd_data, ensure_ascii=False, indent=2))
    print(f"Written: {hsd_path}")

    # Write ahsp items by divisi
    ahsp_base = OUTPUT_BASE / "ahsp"
    written_files = []
    for divisi_num in sorted(by_divisi.keys()):
        items = by_divisi[divisi_num]
        divisi_dir = ahsp_base / f"divisi-{divisi_num}"
        divisi_dir.mkdir(parents=True, exist_ok=True)
        out_path = divisi_dir / "items.json"
        out_path.write_text(json.dumps(items, ensure_ascii=False, indent=2))
        print(f"Written: {out_path} ({len(items)} items)")
        written_files.append((divisi_num, out_path, len(items)))

    # Summary
    print("\n=== Summary ===")
    print(f"Total AHSP items: {len(all_items)}")
    for divisi_num, path, count in written_files:
        print(f"  Divisi {divisi_num}: {count} items → {path.relative_to(Path(__file__).parent.parent)}")
    print("\nExtraction complete!")

    return written_files


if __name__ == "__main__":
    main()
