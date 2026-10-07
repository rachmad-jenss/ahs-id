"""Link AHSP item codes (kode_ahsp) to HSP breakdown tables via PDF text order."""

from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ahs_id.spot_check import _PdfPageCache, build_table_page_map, refine_page_map_for_hsp_rows
from ahs_id.table_clean import parse_id_number

_KODE_AHSP = re.compile(r"^(A\.[\d\w\.]+)\s+(.+)$", re.MULTILINE)
_KODE_BM = re.compile(r"^(\d+\.\d+\.\([\w\d]+[a-z]?)\)\s+(.+)$", re.MULTILINE)
_KODE_CK_ITEM = re.compile(r"^(\d+\.\d+\.\d+)\s+(.+)$", re.MULTILINE)
_KODE_CK_INLINE = re.compile(r"(\d+\.\d+\.\d+)\s*([^\n]{4,200})")
_KODE_CK_LONG = re.compile(r"(\d+(?:\.[\w\d]+){3,})\s*([^\n]{4,200})")
_KODE_SDA_INLINE_A = re.compile(r"(A\.\d[\w\.]*)\s*([^\n]{4,200})")
_KODE_SDA_INLINE_TX = re.compile(r"(TM\.\d{2}[\w\.]*|T\.\d{2}[\w\.]*)\s*([^\n]{4,200})")
_REF_KODE = re.compile(r"^[LMEB]\.", re.I)
_ITEM_KODE = re.compile(r"^A\.\d", re.I)
_HSP_TABLE_MARKERS = re.compile(
    r"A\s+Tenaga\s+Kerja|1\s+2\s+3\s+4\s+5\s+6\s+7|Harga\s+Satuan",
    re.I,
)


def _is_sda_item_kode(candidate: str) -> bool:
    """SDA PDF item headers: A.*, T.04…, TM.02… (not time refs like T.1)."""
    if _REF_KODE.match(candidate):
        return False
    if candidate.startswith("TM."):
        parts = candidate.split(".")
        return len(parts) >= 3 and parts[1].isdigit()
    if candidate.startswith("T.") and not candidate.startswith("TM."):
        parts = candidate.split(".")
        return len(parts) >= 3 and len(parts[1]) >= 2 and parts[1].isdigit()
    return bool(_ITEM_KODE.match(candidate))


def _iter_sda_inline_matches(text: str) -> list[re.Match[str]]:
    hits: list[re.Match[str]] = []
    for pattern in (_KODE_SDA_INLINE_A, _KODE_SDA_INLINE_TX):
        hits.extend(pattern.finditer(text))
    hits.sort(key=lambda m: m.start())
    return hits


def _block_has_hsp_table(block: str) -> bool:
    return bool(_HSP_TABLE_MARKERS.search(block))


def _orphan_hsp_anchors_on_page(
    text: str,
    page_num: int,
    taken: set[tuple[int, str]],
) -> list[PdfHspAnchor]:
    """HSP tables without a preceding A./T./TM. item line (e.g. Contoh AHSP appendix)."""
    out: list[PdfHspAnchor] = []
    for header in re.finditer(r"1\s+2\s+3\s+4\s+5\s+6\s+7", text):
        block = text[header.start() : min(len(text), header.start() + 2500)]
        if not re.search(r"A\s+Tenaga\s+Kerja", block, re.I):
            continue
        l01 = _first_l01_koef(block)
        if l01 is None:
            continue
        before = text[max(0, header.start() - 1500) : header.start()]
        kode: str | None = None
        uraian = ""
        for match in reversed(_iter_sda_inline_matches(before)):
            candidate = match.group(1)
            if _is_sda_item_kode(candidate):
                kode = candidate
                uraian = match.group(2).strip()[:120]
                break
        if not kode:
            title = re.search(
                r"(?:Contoh\s+AHSP[^\n]{0,120}|a\.\s*Contoh[^\n]{0,120})",
                before,
                re.I,
            )
            uraian = (title.group(0).strip() if title else "HSP tanpa kode item")[:120]
            kode = f"SDA-ORPHAN.P{page_num}"
            if (page_num, kode) in taken:
                kode = f"SDA-ORPHAN.P{page_num}.L{int(round(l01 * 1_000_000))}"
        if (page_num, kode) in taken:
            continue
        taken.add((page_num, kode))
        out.append(
            PdfHspAnchor(
                kode_ahsp=kode,
                uraian=uraian,
                page=page_num,
                l01_koef=l01,
            )
        )
    return out


def _is_item_kode(candidate: str, valid_kodes: set[str] | None) -> bool:
    if _REF_KODE.match(candidate):
        return False
    if not _ITEM_KODE.match(candidate):
        return False
    if valid_kodes is not None and candidate not in valid_kodes:
        return False
    return True
_HSP_HEADER = re.compile(r"^\s*1\s+2\s+3\s+4\s+5\s+6\s+7\s*$", re.MULTILINE)
_HSP_HEADER_BM = re.compile(
    r"PERKIRAAN HARGA JUMLAH|NO\.\s+KOMPONEN\s+SATUAN",
    re.MULTILINE | re.I,
)
_TK_SECTION = re.compile(r"^\s*A\s+Tenaga Kerja\s*$", re.MULTILINE | re.I)


@dataclass(frozen=True)
class PdfHspAnchor:
    """One AHSP item header immediately before an HSP breakdown block in the PDF."""

    kode_ahsp: str
    uraian: str
    page: int
    l01_koef: float | None


def load_index_kodes(item_index_path: Path) -> set[str]:
    rows = csv.DictReader(item_index_path.open(encoding="utf-8"))
    return {row["kode"].strip() for row in rows if row.get("kode", "").strip()}


def load_index_lookup(item_index_path: Path) -> dict[str, dict[str, str]]:
    lookup: dict[str, dict[str, str]] = {}
    for row in csv.DictReader(item_index_path.open(encoding="utf-8")):
        kode = row.get("kode", "").strip()
        if kode:
            lookup[kode] = row
    return lookup


def _first_l01_koef(block: str) -> float | None:
    """Parse first Pekerja L01/L.01 koefisien from an HSP text block."""
    for line in block.splitlines():
        if "L01" not in line and "L.01" not in line:
            continue
        parts = re.split(r"\s+", line.strip())
        for i, part in enumerate(parts):
            if part in {"L.01", "L01"} and i + 2 < len(parts):
                val = parse_id_number(parts[i + 2])
                if val is not None:
                    return val
        m = re.search(r"L\.?01\s+\w+\s+([\d,\.]+)", line)
        if m:
            return parse_id_number(m.group(1))
    return None


def _match_item_kode_line(line: str, valid_kodes: set[str] | None) -> tuple[str, str] | None:
    for pattern in (_KODE_AHSP, _KODE_BM):
        km = pattern.match(line)
        if not km:
            continue
        candidate = km.group(1)
        if pattern is _KODE_BM or _is_item_kode(candidate, valid_kodes):
            return candidate, km.group(2).strip()
    return None


def _page_text(pdf: Any, page_num: int) -> str:
    """Extract plain text from an open pypdfium2 document (1-based page)."""
    page = pdf[page_num - 1]
    textpage = page.get_textpage()
    return textpage.get_text_range(0, textpage.count_chars()).replace("\u00a0", " ")


def _scan_page_for_anchors(
    text: str,
    page_num: int,
    valid_kodes: set[str] | None,
    seen_at_pos: set[tuple[int, str]],
) -> list[PdfHspAnchor]:
    anchors: list[PdfHspAnchor] = []
    header_matches = list(_HSP_HEADER.finditer(text)) + list(_HSP_HEADER_BM.finditer(text))
    for m in header_matches:
        before = text[max(0, m.start() - 1200) : m.start()]
        lines = [ln.strip() for ln in before.splitlines() if ln.strip()]

        kode_ahsp: str | None = None
        uraian = ""
        for line in reversed(lines[-20:]):
            matched = _match_item_kode_line(line, valid_kodes)
            if matched:
                kode_ahsp, uraian = matched
                break

        if not kode_ahsp:
            continue

        after = text[m.start() : min(len(text), m.start() + 2500)]
        l01 = _first_l01_koef(after)
        key = (page_num, kode_ahsp)
        if key in seen_at_pos:
            continue
        seen_at_pos.add(key)
        anchors.append(
            PdfHspAnchor(
                kode_ahsp=kode_ahsp,
                uraian=uraian,
                page=page_num,
                l01_koef=l01,
            )
        )
    return anchors


def extract_sda_inline_anchors_from_pdf(
    pdf_path: Path,
    *,
    page_start: int = 1,
    page_end: int | None = None,
    cache_path: Path | None = None,
) -> list[PdfHspAnchor]:
    """
    SDA layout: item kode A.x.xx + HSP inline on the same page (no 1-7 header required).
    """
    if cache_path and cache_path.is_file():
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        return [
            PdfHspAnchor(
                kode_ahsp=a["kode_ahsp"],
                uraian=a["uraian"],
                page=a["page"],
                l01_koef=a.get("l01_koef"),
            )
            for a in data
        ]

    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(str(pdf_path))
    total = len(pdf)
    end = page_end or total
    anchors: list[PdfHspAnchor] = []
    seen: set[tuple[int, str, float | None]] = set()

    for page_num in range(page_start, min(end, total) + 1):
        text = _page_text(pdf, page_num)
        if not text.strip():
            continue
        for match in _iter_sda_inline_matches(text):
            kode = match.group(1)
            if not _is_sda_item_kode(kode):
                continue
            uraian = match.group(2).strip()
            if not uraian or uraian[0].isdigit():
                continue
            block = text[match.start() : min(len(text), match.start() + 2500)]
            if not _block_has_hsp_table(block):
                continue
            l01 = _first_l01_koef(block)
            key = (page_num, kode, l01)
            if key in seen:
                continue
            seen.add(key)
            anchors.append(
                PdfHspAnchor(
                    kode_ahsp=kode,
                    uraian=uraian,
                    page=page_num,
                    l01_koef=l01,
                )
            )

        taken_on_page = {(a.page, a.kode_ahsp) for a in anchors if a.page == page_num}
        for orphan in _orphan_hsp_anchors_on_page(text, page_num, taken_on_page):
            key = (page_num, orphan.kode_ahsp, orphan.l01_koef)
            if key in seen:
                continue
            seen.add(key)
            anchors.append(orphan)

    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(
            json.dumps(
                [
                    {
                        "kode_ahsp": a.kode_ahsp,
                        "uraian": a.uraian,
                        "page": a.page,
                        "l01_koef": a.l01_koef,
                    }
                    for a in anchors
                ],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    return anchors


def _merge_anchors(*groups: list[PdfHspAnchor]) -> list[PdfHspAnchor]:
    """Dedupe anchors by page + kode; prefer entry with L01 koefisien."""
    best: dict[tuple[int, str], PdfHspAnchor] = {}
    for anchor in (a for group in groups for a in group):
        key = (anchor.page, anchor.kode_ahsp)
        prev = best.get(key)
        if prev is None or (prev.l01_koef is None and anchor.l01_koef is not None):
            best[key] = anchor
    return sorted(best.values(), key=lambda a: (a.page, a.kode_ahsp))


def extract_ck_inline_anchors_from_pdf(
    pdf_path: Path,
    *,
    page_start: int = 1,
    page_end: int | None = None,
    cache_path: Path | None = None,
) -> list[PdfHspAnchor]:
    """
    Cipta Karya layout: item kode + HSP inline on the same page.

    Example (page text):
      3.13.2 Pemasangan 1 m2 Profil Jalusi Aluminium
      A TENAGA KERJA
      1 Pekerja L.01 OH 0,0430
    """
    if cache_path and cache_path.is_file():
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        return [
            PdfHspAnchor(
                kode_ahsp=a["kode_ahsp"],
                uraian=a["uraian"],
                page=a["page"],
                l01_koef=a.get("l01_koef"),
            )
            for a in data
        ]

    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(str(pdf_path))
    total = len(pdf)
    end = page_end or total
    anchors: list[PdfHspAnchor] = []
    seen: set[tuple[int, str, float | None]] = set()

    for page_num in range(page_start, min(end, total) + 1):
        text = _page_text(pdf, page_num)
        if not text.strip():
            continue
        for match in _KODE_CK_INLINE.finditer(text):
            uraian = match.group(2).strip()
            if not uraian or uraian[0].isdigit():
                continue
            block = text[match.start() : min(len(text), match.start() + 2500)]
            if not _block_has_hsp_table(block):
                continue
            kode = match.group(1)
            l01 = _first_l01_koef(block)
            key = (page_num, kode, l01)
            if key in seen:
                continue
            seen.add(key)
            anchors.append(
                PdfHspAnchor(
                    kode_ahsp=kode,
                    uraian=uraian,
                    page=page_num,
                    l01_koef=l01,
                )
            )

        for match in _KODE_CK_LONG.finditer(text):
            kode = match.group(1)
            uraian = match.group(2).strip()
            if not uraian or uraian[0].isdigit():
                continue
            block = text[match.start() : min(len(text), match.start() + 2500)]
            if not _block_has_hsp_table(block):
                continue
            l01 = _first_l01_koef(block)
            key = (page_num, kode, l01)
            if key in seen:
                continue
            seen.add(key)
            anchors.append(
                PdfHspAnchor(
                    kode_ahsp=kode,
                    uraian=uraian,
                    page=page_num,
                    l01_koef=l01,
                )
            )

        taken_on_page = {(a.page, a.kode_ahsp) for a in anchors if a.page == page_num}
        for header in re.finditer(r"1\s+2\s+3\s+4\s+5\s+6\s+7", text):
            block = text[header.start() : min(len(text), header.start() + 2500)]
            if not re.search(r"A\s+Tenaga\s+Kerja", block, re.I):
                continue
            l01 = _first_l01_koef(block)
            if l01 is None:
                continue
            before = text[max(0, header.start() - 1500) : header.start()]
            kode: str | None = None
            uraian = ""
            for match in reversed(list(_KODE_CK_LONG.finditer(before))):
                kode = match.group(1)
                uraian = match.group(2).strip()[:120]
                break
            if not kode:
                continue
            if (page_num, kode) in taken_on_page:
                continue
            taken_on_page.add((page_num, kode))
            key = (page_num, kode, l01)
            if key in seen:
                continue
            seen.add(key)
            anchors.append(
                PdfHspAnchor(
                    kode_ahsp=kode,
                    uraian=uraian,
                    page=page_num,
                    l01_koef=l01,
                )
            )

    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(
            json.dumps(
                [
                    {
                        "kode_ahsp": a.kode_ahsp,
                        "uraian": a.uraian,
                        "page": a.page,
                        "l01_koef": a.l01_koef,
                    }
                    for a in anchors
                ],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    return anchors


def extract_hsp_anchors_from_pdf(
    pdf_path: Path,
    *,
    valid_kodes: set[str] | None = None,
    page_start: int = 1,
    page_end: int | None = None,
    cache_path: Path | None = None,
) -> list[PdfHspAnchor]:
    """
    Scan PDF text for item kode lines immediately preceding HSP breakdown tables.

    Regulation layout (observed SE DJBK 47/2026):
      A.3.01.1a.1 1 m2 Uraian pekerjaan...
      No. Uraian Kode ...
      1 2 3 4 5 6 7
      A Tenaga Kerja
    """
    if cache_path and cache_path.is_file():
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        return [
            PdfHspAnchor(
                kode_ahsp=a["kode_ahsp"],
                uraian=a["uraian"],
                page=a["page"],
                l01_koef=a.get("l01_koef"),
            )
            for a in data
        ]

    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(str(pdf_path))
    total = len(pdf)
    end = page_end or total

    anchors: list[PdfHspAnchor] = []
    seen_at_pos: set[tuple[int, str]] = set()

    for page_num in range(page_start, min(end, total) + 1):
        text = _page_text(pdf, page_num)
        if not text.strip():
            continue
        anchors.extend(_scan_page_for_anchors(text, page_num, valid_kodes, seen_at_pos))

    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(
            json.dumps(
                [
                    {
                        "kode_ahsp": a.kode_ahsp,
                        "uraian": a.uraian,
                        "page": a.page,
                        "l01_koef": a.l01_koef,
                    }
                    for a in anchors
                ],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    return anchors


def _l01_from_hsp_row(row: dict[str, Any]) -> float | None:
    for coef in row.get("coefficients", []):
        kode = coef.get("kode") or ""
        uraian = (coef.get("uraian") or "").lower()
        if (
            kode in {"L.01", "L01"}
            or re.search(r"l\.?01", kode, re.I)
            or re.search(r"l\.?01", uraian)
        ):
            return coef.get("koefisien")
        if not kode and "pekerja" in uraian:
            return coef.get("koefisien")
    return None


_SDA_PAGE_SLACK = 3


def _page_slack_range(pages: tuple[int, int] | None, slack: int = _SDA_PAGE_SLACK) -> tuple[int, int] | None:
    if not pages:
        return None
    if pages[0] == pages[1]:
        p = pages[0]
        return (max(1, p - slack), p + slack)
    return pages


def _primary_material_kode(row: dict[str, Any]) -> str | None:
    for coef in row.get("coefficients", []):
        kode = (coef.get("kode") or "").strip()
        if kode.startswith(("M.", "E.")):
            return kode
    return None


def _linkable_for_sda(row: dict[str, Any]) -> bool:
    """SDA rows that should receive kode_ahsp (incl. equipment-only / total-only breakdowns)."""
    if _l01_from_hsp_row(row) is not None:
        return True
    sections = set(row.get("sections") or [])
    if sections <= {"data"}:
        return False
    if row.get("harga_satuan_pekerjaan") is not None:
        return True
    coefs = row.get("coefficients") or []
    return bool(sections & {"A", "B", "C", "D", "E"}) and any(
        c.get("koefisien") is not None for c in coefs
    )


def _row_page_mid(
    row: dict[str, Any],
    page_map: dict[int, tuple[int, int]] | None,
) -> int | None:
    if not page_map:
        return None
    pages = page_map.get(row["table_index"])
    if not pages:
        return None
    return pages[0] if pages[0] == pages[1] else (pages[0] + pages[1]) // 2


def _link_batch_pass(
    linkable: list[dict[str, Any]],
    anchors: list[PdfHspAnchor],
    used_anchor_idx: set[int],
    page_map: dict[int, tuple[int, int]] | None,
    linked_by_index: dict[int, dict[str, Any]],
    assign_fn: Any,
) -> None:
    """Match remaining rows inside each checkpoint page batch (order + L01)."""
    from collections import defaultdict

    unlinked = [r for r in linkable if r["table_index"] not in linked_by_index]
    by_batch: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for row in unlinked:
        pages = page_map.get(row["table_index"]) if page_map else None
        if pages:
            by_batch[pages].append(row)

    for pages, rows in by_batch.items():
        rows.sort(key=lambda r: r["table_index"])
        avail = [
            i
            for i, a in enumerate(anchors)
            if i not in used_anchor_idx and pages[0] <= a.page <= pages[1]
        ]
        if not avail:
            continue

        for row in rows:
            if row["table_index"] in linked_by_index:
                continue
            l01 = _l01_from_hsp_row(row)
            if l01 is None:
                continue
            best_i: int | None = None
            for i in avail:
                if i in used_anchor_idx:
                    continue
                a = anchors[i]
                if a.l01_koef is not None and abs(a.l01_koef - l01) < 0.00011:
                    best_i = i
                    break
            if best_i is not None:
                assign_fn(row, anchors[best_i], "batch_l01", best_i)

        avail = [i for i in avail if i not in used_anchor_idx]
        avail.sort(key=lambda i: anchors[i].page)
        for row, idx in zip(
            [r for r in rows if r["table_index"] not in linked_by_index],
            avail,
        ):
            assign_fn(row, anchors[idx], "batch_sequential", idx)


def link_hsp_tables(
    hsp_parsed_path: Path,
    anchors: list[PdfHspAnchor],
    *,
    page_map: dict[int, tuple[int, int]] | None = None,
    pdf_path: Path | None = None,
) -> list[dict[str, Any]]:
    """
    Assign kode_ahsp to HSP breakdown rows.

    Only tables with a parseable L.01 koefisien consume PDF anchors.
    Template/partial tables are left unlinked so they do not steal anchors.
    """
    hsp_rows = [json.loads(line) for line in hsp_parsed_path.read_text(encoding="utf-8").splitlines()]
    used_anchor_idx: set[int] = set()
    linked_by_index: dict[int, dict[str, Any]] = {}

    def _assign(row: dict[str, Any], matched: PdfHspAnchor, method: str, idx: int) -> None:
        used_anchor_idx.add(idx)
        tidx = row["table_index"]
        out = dict(row)
        out["kode_ahsp"] = matched.kode_ahsp
        out["kode_link_method"] = method
        out["kode_link_page"] = matched.page
        out["uraian_item"] = matched.uraian
        pages = page_map.get(tidx) if page_map else None
        if pages:
            out["page_range"] = f"{pages[0]}-{pages[1]}"
        linked_by_index[tidx] = out

    def _l01_anchor_hits(l01: float, pages: tuple[int, int] | None) -> list[int]:
        hits: list[int] = []
        for i, cand in enumerate(anchors):
            if i in used_anchor_idx:
                continue
            if cand.l01_koef is not None and abs(cand.l01_koef - l01) < 0.00011:
                hits.append(i)
        if pages:
            hits = [i for i in hits if pages[0] <= anchors[i].page <= pages[1]]
        return hits

    def _pick_l01_confident(row: dict[str, Any]) -> tuple[PdfHspAnchor | None, str | None, int | None]:
        l01 = _l01_from_hsp_row(row)
        if l01 is None:
            return None, None, None
        pages = page_map.get(row["table_index"]) if page_map else None
        hits = _l01_anchor_hits(l01, pages)
        if len(hits) == 1:
            return anchors[hits[0]], "l01_unique", hits[0]
        if len(hits) > 1 and pages:
            mid = (pages[0] + pages[1]) // 2
            best = min(hits, key=lambda i: abs(anchors[i].page - mid))
            return anchors[best], "page_l01_nearest", best
        if len(hits) > 1:
            best = min(hits, key=lambda i: anchors[i].page)
            return anchors[best], "l01_nearest_global", best
        return None, None, None

    def _pick_l01_page_mismatch(row: dict[str, Any]) -> tuple[PdfHspAnchor | None, str | None, int | None]:
        l01 = _l01_from_hsp_row(row)
        if l01 is None:
            return None, None, None
        pages = page_map.get(row["table_index"]) if page_map else None
        if not pages:
            return None, None, None
        for i, cand in enumerate(anchors):
            if i in used_anchor_idx:
                continue
            if pages[0] <= cand.page <= pages[1]:
                return anchors[i], "page_nearest_mismatch", i
        return None, None, None

    def _pick_l01_global_match(row: dict[str, Any]) -> tuple[PdfHspAnchor | None, str | None, int | None]:
        l01 = _l01_from_hsp_row(row)
        if l01 is None:
            return None, None, None
        for i, cand in enumerate(anchors):
            if i in used_anchor_idx:
                continue
            if cand.l01_koef is not None and abs(cand.l01_koef - l01) < 0.00011:
                return anchors[i], "sequential", i
        return None, None, None

    linkable = sorted(
        [r for r in hsp_rows if _l01_from_hsp_row(r) is not None],
        key=lambda r: r["table_index"],
    )
    for row in linkable:
        matched, method, idx = _pick_l01_confident(row)
        if matched is not None and idx is not None and method is not None:
            _assign(row, matched, method, idx)

    _link_batch_pass(linkable, anchors, used_anchor_idx, page_map, linked_by_index, _assign)

    for row in linkable:
        if row["table_index"] in linked_by_index:
            continue
        matched, method, idx = _pick_l01_page_mismatch(row)
        if matched is not None and idx is not None and method is not None:
            _assign(row, matched, method, idx)

    _link_batch_pass(linkable, anchors, used_anchor_idx, page_map, linked_by_index, _assign)

    for row in linkable:
        if row["table_index"] in linked_by_index:
            continue
        matched, method, idx = _pick_l01_global_match(row)
        if matched is not None and idx is not None and method is not None:
            _assign(row, matched, method, idx)

    def _pick_l01_page_slack(row: dict[str, Any]) -> tuple[PdfHspAnchor | None, str | None, int | None]:
        l01 = _l01_from_hsp_row(row)
        if l01 is None:
            return None, None, None
        pages = page_map.get(row["table_index"]) if page_map else None
        slack = _page_slack_range(pages)
        if not slack:
            return None, None, None
        hits: list[int] = []
        for i, cand in enumerate(anchors):
            if i in used_anchor_idx:
                continue
            if cand.l01_koef is not None and abs(cand.l01_koef - l01) < 0.00011:
                if slack[0] <= cand.page <= slack[1]:
                    hits.append(i)
        if not hits:
            return None, None, None
        if pages and pages[0] == pages[1]:
            target = pages[0]
            best = min(hits, key=lambda i: abs(anchors[i].page - target))
            return anchors[best], "page_slack_l01", best
        if len(hits) == 1:
            return anchors[hits[0]], "page_slack_l01", hits[0]
        return None, None, None

    for row in linkable:
        if row["table_index"] in linked_by_index:
            continue
        matched, method, idx = _pick_l01_page_slack(row)
        if matched is not None and idx is not None and method is not None:
            _assign(row, matched, method, idx)

    extended = sorted(
        [
            r
            for r in hsp_rows
            if _linkable_for_sda(r)
            and _l01_from_hsp_row(r) is None
            and r["table_index"] not in linked_by_index
        ],
        key=lambda r: r["table_index"],
    )

    def _anchor_indices_in_slack(row: dict[str, Any], *, used_ok: bool) -> list[int]:
        pages = page_map.get(row["table_index"]) if page_map else None
        slack = _page_slack_range(pages)
        if not slack:
            return []
        out: list[int] = []
        for i, cand in enumerate(anchors):
            if not used_ok and i in used_anchor_idx:
                continue
            if slack[0] <= cand.page <= slack[1]:
                out.append(i)
        return out

    for row in extended:
        hits = [
            i
            for i in _anchor_indices_in_slack(row, used_ok=False)
            if i not in used_anchor_idx
        ]
        if len(hits) == 1:
            _assign(row, anchors[hits[0]], "page_unique_no_l01", hits[0])

    _link_batch_pass(extended, anchors, used_anchor_idx, page_map, linked_by_index, _assign)

    for row in extended:
        if row["table_index"] in linked_by_index:
            continue
        hits = [i for i in _anchor_indices_in_slack(row, used_ok=False) if i not in used_anchor_idx]
        if len(hits) == 1:
            _assign(row, anchors[hits[0]], "batch_page_unique_no_l01", hits[0])

    for row in sorted(extended, key=lambda r: r["table_index"]):
        if row["table_index"] in linked_by_index:
            continue
        avail = [i for i in _anchor_indices_in_slack(row, used_ok=False) if i not in used_anchor_idx]
        if not avail:
            continue
        pages = page_map.get(row["table_index"]) if page_map else None
        target = pages[0] if pages and pages[0] == pages[1] else _row_page_mid(row, page_map)
        avail.sort(
            key=lambda i: (
                abs(anchors[i].page - target) if target is not None else anchors[i].page,
                anchors[i].kode_ahsp,
            )
        )
        _assign(row, anchors[avail[0]], "page_sequential_no_l01", avail[0])

    pdf_text_cache: _PdfPageCache | None = None

    def _page_text(page_num: int) -> str:
        nonlocal pdf_text_cache
        if pdf_text_cache is None:
            raise RuntimeError("pdf cache not initialized")
        return pdf_text_cache.get(page_num)

    for row in linkable + extended:
        if row["table_index"] in linked_by_index:
            continue
        mat = _primary_material_kode(row)
        if not mat:
            continue
        pages = page_map.get(row["table_index"]) if page_map else None
        slack = _page_slack_range(pages)
        if not slack:
            continue
        hits: list[int] = []
        for i, cand in enumerate(anchors):
            if i in used_anchor_idx:
                continue
            if not (slack[0] <= cand.page <= slack[1]):
                continue
            if pdf_text_cache is None:
                if pdf_path is None:
                    break
                pdf_text_cache = _PdfPageCache(pdf_path)
            if mat in _page_text(cand.page):
                hits.append(i)
        if len(hits) != 1:
            continue
        _assign(row, anchors[hits[0]], "material_slack", hits[0])

    for row in hsp_rows:
        if row["table_index"] in linked_by_index:
            continue
        if not _linkable_for_sda(row):
            continue
        l01 = _l01_from_hsp_row(row)
        pages = page_map.get(row["table_index"]) if page_map else None
        slack = _page_slack_range(pages)
        if not slack:
            continue
        tidx = row["table_index"]
        best_other: dict[str, Any] | None = None
        best_dist = 10_000
        for other in linked_by_index.values():
            op = page_map.get(other["table_index"]) if page_map else None
            if not op:
                continue
            if not (slack[0] <= op[0] <= slack[1] and slack[0] <= op[1] <= slack[1]):
                continue
            mat = _primary_material_kode(row)
            omat = _primary_material_kode(other)
            if mat and omat and mat != omat:
                continue
            if l01 is not None:
                ol01 = _l01_from_hsp_row(other)
                if ol01 is None or abs(ol01 - l01) >= 0.00011:
                    continue
            elif row.get("harga_satuan_pekerjaan") is None:
                continue
            elif other.get("harga_satuan_pekerjaan") != row.get("harga_satuan_pekerjaan"):
                continue
            dist = abs(other["table_index"] - tidx)
            if dist < best_dist and dist <= 24:
                best_dist = dist
                best_other = other
        if best_other is None or not best_other.get("kode_ahsp"):
            continue
        out = dict(row)
        out["kode_ahsp"] = best_other["kode_ahsp"]
        out["kode_link_method"] = "sibling_mirror"
        out["kode_link_page"] = best_other.get("kode_link_page")
        out["uraian_item"] = best_other.get("uraian_item")
        if pages:
            out["page_range"] = f"{pages[0]}-{pages[1]}"
        linked_by_index[tidx] = out

    linked: list[dict[str, Any]] = []
    for row in hsp_rows:
        tidx = row["table_index"]
        if tidx in linked_by_index:
            linked.append(linked_by_index[tidx])
            continue
        out = dict(row)
        out["kode_ahsp"] = None
        out["kode_link_method"] = None
        out["kode_link_page"] = None
        out["uraian_item"] = None
        pages = page_map.get(tidx) if page_map else None
        if pages:
            out["page_range"] = f"{pages[0]}-{pages[1]}"
        linked.append(out)

    return linked


def run_kode_link(
    *,
    pdf_path: Path,
    item_index_path: Path,
    hsp_parsed_path: Path,
    checkpoint_dir: Path,
    output_path: Path,
    page_start: int = 1,
    page_end: int | None = None,
    ck_inline: bool = False,
) -> dict[str, Any]:
    """Full pipeline: extract anchors from PDF, link to hsp-parsed, write JSONL + summary."""
    page_map = build_table_page_map(checkpoint_dir)
    hsp_preview = [
        json.loads(line)
        for line in hsp_parsed_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not ck_inline:
        refine_rows = [r for r in hsp_preview if _linkable_for_sda(r)]
        page_map = refine_page_map_for_hsp_rows(page_map, refine_rows, pdf_path)

    if ck_inline:
        cache_path = output_path.with_name("ck-anchors.json")
        anchors = extract_ck_inline_anchors_from_pdf(
            pdf_path,
            page_start=page_start,
            page_end=page_end,
            cache_path=cache_path,
        )
    else:
        header_cache = output_path.with_name("kode-anchors.json")
        inline_cache = output_path.with_name("sda-inline-anchors.json")
        header = extract_hsp_anchors_from_pdf(
            pdf_path,
            valid_kodes=None,
            page_start=page_start,
            page_end=page_end,
            cache_path=header_cache,
        )
        inline = extract_sda_inline_anchors_from_pdf(
            pdf_path,
            page_start=page_start,
            page_end=page_end,
            cache_path=inline_cache,
        )
        anchors = _merge_anchors(header, inline)
    index_lookup: dict[str, dict[str, str]] = {}
    if item_index_path.is_file():
        index_lookup = load_index_lookup(item_index_path)
    linked = link_hsp_tables(
        hsp_parsed_path,
        anchors,
        page_map=page_map,
        pdf_path=pdf_path,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        for row in linked:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")

    with_kode = sum(1 for r in linked if r.get("kode_ahsp"))
    fingerprint = sum(
        1
        for r in linked
        if r.get("kode_link_method")
        in ("l01_unique", "page_l01", "page_l01_nearest", "page_l01_nearest")
    )
    high_confidence = sum(
        1 for r in linked if r.get("kode_link_method") in ("l01_unique", "page_l01_nearest")
    )
    mismatch = sum(
        1
        for r in linked
        if r.get("kode_link_method") in ("page_nearest_mismatch", "sequential_mismatch")
    )
    filled = sum(1 for r in linked if r.get("harga_satuan_pekerjaan"))

    # Cross-check index satuan
    satuan_ok = 0
    for row in linked:
        kode = row.get("kode_ahsp")
        if not kode or kode not in index_lookup:
            continue
        satuan_ok += 1

    summary = {
        "pdf_anchors_found": len(anchors),
        "hsp_tables": len(linked),
        "linked": with_kode,
        "link_rate_pct": round(100 * with_kode / len(linked), 1) if linked else 0,
        "high_confidence_links": high_confidence,
        "page_l01_matches": fingerprint,
        "sequential_mismatch_warnings": mismatch,
        "hsp_with_total": filled,
        "output": str(output_path),
    }

    summary_path = output_path.with_name("kode-link-summary.json")
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    # CSV map for quick lookup
    map_path = output_path.with_name("kode-table-map.csv")
    with map_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "table_index",
                "table_csv",
                "kode_ahsp",
                "uraian_item",
                "page",
                "page_range",
                "link_method",
                "harga_satuan_pekerjaan",
            ],
        )
        writer.writeheader()
        for row in linked:
            if not row.get("kode_ahsp"):
                continue
            writer.writerow(
                {
                    "table_index": row["table_index"],
                    "table_csv": f"table-{row['table_index'] + 1:04d}.csv",
                    "kode_ahsp": row["kode_ahsp"],
                    "uraian_item": row.get("uraian_item", ""),
                    "page": row.get("kode_link_page", ""),
                    "page_range": row.get("page_range", ""),
                    "link_method": row.get("kode_link_method", ""),
                    "harga_satuan_pekerjaan": row.get("harga_satuan_pekerjaan", ""),
                }
            )

    summary["kode_table_map"] = str(map_path)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary
