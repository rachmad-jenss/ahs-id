"""Detect Bina Marga multi-page formular blocks and link HSP tables to item kodes."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ahs_id.kode_link import PdfHspAnchor, _first_l01_koef
from ahs_id.spot_check import build_table_page_map, refine_page_map_for_hsp_rows
from ahs_id.table_clean import parse_id_number

_KODE_IN_PARENS = re.compile(r"\((\d+\.\d+\.\([\w\d]+[a-z]?\)?)\)")
_KODE_LINE = re.compile(r"^(\d+\.\d+\.\([\w\d]+[a-z]?\)?)\s+(.+)$", re.MULTILINE)
_TITLE_WITH_KODE = re.compile(
    r"^[A-Z]\.\d+\s+.+?\((\d+\.\d+\.\([\w\d]+[a-z]?\)?)\)",
    re.MULTILINE | re.I,
)
_ASUMSI = re.compile(r"I\.\s*ASUMSI", re.I)
_FORMULAR_PAGE = re.compile(
    r"ASUMSI|URUTAN\s+KERJA|DATA\s+DAN\s+ASUMSI|ANALISA\s+HARGA",
    re.I,
)
_PAGE_EXPAND = 35
_L01_ABS_TOL = 0.0002
_L01_REL_TOL = 0.06
_HSP_MARKER = "PERKIRAAN HARGA JUMLAH"
_HSP_MARKER_LOOSE = re.compile(r"PERKIRAAN\s+HARGA", re.I)
_HSP_BODY = re.compile(r"NO\.\s*KOMPONEN|A\.\s*TENAGA", re.I)
_PAGE_INDEX_VERSION = 4


def _is_hsp_text(text: str) -> bool:
    """BM HSP breakdown page (exclude blank HSD forms that only have PERKIRAAN HARGA header)."""
    has_marker = _HSP_MARKER in text or bool(_HSP_MARKER_LOOSE.search(text))
    if not has_marker:
        return False
    if _HSP_BODY.search(text):
        return True
    return _first_l01_koef(text) is not None


def formular_block_expects_hsp_table(page_text: str) -> bool:
    """Formular block that should have a matching Docling HSP table (not empty template)."""
    return _is_hsp_text(page_text)


def _read_pdf_page_text(doc: Any, page_num: int, limit: int = 3500) -> str:
    textpage = doc[page_num - 1].get_textpage()
    char_count = min(limit, textpage.count_chars())
    if char_count <= 0:
        return ""
    return textpage.get_text_range(0, char_count).replace("\u00a0", " ")


@dataclass(frozen=True)
class PageMeta:
    """Lightweight per-page signals (no full text stored)."""

    page: int
    is_hsp: bool
    has_asumsi: bool
    kode: str | None
    uraian: str | None
    l01_koef: float | None


@dataclass(frozen=True)
class FormularBlock:
    """One AHSP formular: title/ASUMSI pages → HSP breakdown page."""

    kode_ahsp: str
    uraian: str
    title_page: int
    hsp_page: int
    l01_koef: float | None


def _page_text(pdf: Any, page_num: int) -> str:
    page = pdf[page_num - 1]
    textpage = page.get_textpage()
    return textpage.get_text_range(0, textpage.count_chars()).replace("\u00a0", " ")


def _uraian_from_title_line(line: str, kode: str) -> str:
    text = line.strip()
    text = re.sub(r"\(\d+\.\d+\.\([\w\d]+[a-z]?\)\)", "", text)
    text = re.sub(r"^[A-Z]\.\d+\s*", "", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def _extract_kode_from_page(text: str) -> tuple[str | None, str | None]:
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        m = _TITLE_WITH_KODE.match(stripped)
        if m:
            kode = m.group(1)
            return kode, _uraian_from_title_line(stripped, kode)
        m = _KODE_LINE.match(stripped)
        if m:
            return m.group(1), m.group(2).strip()
        m = _KODE_IN_PARENS.search(stripped)
        if m and not stripped[0].isdigit():
            kode = m.group(1)
            return kode, _uraian_from_title_line(stripped, kode)
    if _FORMULAR_PAGE.search(text) or _ASUMSI.search(text):
        matches = _KODE_IN_PARENS.findall(text)
        if matches:
            kode = matches[0]
            for line in text.splitlines():
                if kode in line:
                    return kode, _uraian_from_title_line(line, kode)
            return kode, ""
    m = _KODE_IN_PARENS.search(text)
    if m and (
        _ASUMSI.search(text)
        or _FORMULAR_PAGE.search(text)
        or "Contoh Analisis" in text
        or "Lampiran" in text
    ):
        kode = m.group(1)
        for line in text.splitlines():
            if kode in line:
                return kode, _uraian_from_title_line(line, kode)
        return kode, ""
    return None, None


def _l01_close(a: float, b: float) -> bool:
    if abs(a - b) < _L01_ABS_TOL:
        return True
    denom = max(abs(a), abs(b), 1e-9)
    return abs(a - b) / denom < _L01_REL_TOL


def _search_page_range(
    pages: tuple[int, int] | None,
    *,
    expand: int = 0,
) -> list[int]:
    if not pages:
        return []
    if expand <= 0:
        return list(range(pages[0], pages[1] + 1))
    mid = (pages[0] + pages[1]) // 2
    return list(range(mid - expand, mid + expand + 1))


def page_meta_from_text(page: int, text: str) -> PageMeta:
    is_hsp = _is_hsp_text(text)
    has_asumsi = bool(_ASUMSI.search(text))
    kode, uraian = _extract_kode_from_page(text)
    l01 = _first_l01_koef(text) if is_hsp else None
    return PageMeta(
        page=page,
        is_hsp=is_hsp,
        has_asumsi=has_asumsi,
        kode=kode,
        uraian=uraian,
        l01_koef=l01,
    )


def build_page_index(
    pdf_path: Path,
    *,
    page_start: int = 1,
    page_end: int | None = None,
    cache_path: Path | None = None,
    progress_every: int = 200,
) -> list[PageMeta]:
    """
    Single-pass PDF scan; cache compact metadata (not full text) for resume.

    ~3125 pages ≈ 2–3 minutes on typical hardware.
    """
    if cache_path and cache_path.is_file():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        if isinstance(cached, dict) and cached.get("version") == _PAGE_INDEX_VERSION:
            rows = cached["pages"]
        elif isinstance(cached, list):
            rows = None  # stale format — rebuild
        else:
            rows = None
        if rows is not None:
            return [
                PageMeta(
                    page=r["page"],
                    is_hsp=r["is_hsp"],
                    has_asumsi=r["has_asumsi"],
                    kode=r.get("kode"),
                    uraian=r.get("uraian"),
                    l01_koef=r.get("l01_koef"),
                )
                for r in rows
            ]

    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(str(pdf_path))
    total = len(pdf)
    end = min(page_end or total, total)
    index: list[PageMeta] = []

    for page_num in range(page_start, end + 1):
        text = _page_text(pdf, page_num)
        index.append(page_meta_from_text(page_num, text))
        if progress_every and page_num % progress_every == 0:
            print(f"  indexed page {page_num}/{end}", flush=True)

    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(
            json.dumps(
                {
                    "version": _PAGE_INDEX_VERSION,
                    "pages": [
                        {
                            "page": m.page,
                            "is_hsp": m.is_hsp,
                            "has_asumsi": m.has_asumsi,
                            "kode": m.kode,
                            "uraian": m.uraian,
                            "l01_koef": m.l01_koef,
                        }
                        for m in index
                    ],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    return index


def extract_formular_blocks(
    page_index: list[PageMeta],
    *,
    lookback: int = 10,
    lookahead: int = 3,
) -> list[FormularBlock]:
    """
    Pair each HSP page with the nearest item kode on preceding pages.

    Typical BM layout (3 pages): ASUMSI (title+kode) → formulir → PERKIRAAN HARGA JUMLAH.

    SE DJBK 47/2026 Lamp. V also places the title/kode on the page *after* the HSP breakdown.
    """
    by_page = {m.page: m for m in page_index}
    blocks: list[FormularBlock] = []

    for meta in page_index:
        if not meta.is_hsp:
            continue

        kode: str | None = None
        uraian = ""
        title_page = meta.page

        for back in range(0, lookback + 1):
            prev = by_page.get(meta.page - back)
            if prev is None or not prev.kode:
                continue
            kode = prev.kode
            uraian = prev.uraian or ""
            title_page = prev.page
            break

        if not kode:
            for fwd in range(1, lookahead + 1):
                nxt = by_page.get(meta.page + fwd)
                if nxt is None or not nxt.kode:
                    continue
                kode = nxt.kode
                uraian = nxt.uraian or ""
                title_page = nxt.page
                break

        if not kode:
            continue

        blocks.append(
            FormularBlock(
                kode_ahsp=kode,
                uraian=uraian,
                title_page=title_page,
                hsp_page=meta.page,
                l01_koef=meta.l01_koef,
            )
        )

    return blocks


def formular_blocks_to_anchors(blocks: list[FormularBlock]) -> list[PdfHspAnchor]:
    return [
        PdfHspAnchor(
            kode_ahsp=b.kode_ahsp,
            uraian=b.uraian,
            page=b.hsp_page,
            l01_koef=b.l01_koef,
        )
        for b in blocks
    ]


def _l01_from_hsp_row(row: dict[str, Any]) -> float | None:
    for coef in row.get("coefficients", []):
        kode = coef.get("kode") or ""
        uraian = (coef.get("uraian") or "").lower()
        if kode in {"L.01", "L01"} or re.search(r"l\.?01", uraian):
            return coef.get("koefisien")
        if not kode and uraian.startswith("pekerja"):
            return coef.get("koefisien")
    return None


def _candidate_blocks(
    blocks_by_page: dict[int, list[FormularBlock]],
    page_nums: list[int],
    used_blocks: set[tuple[int, str]],
) -> list[FormularBlock]:
    candidates: list[FormularBlock] = []
    for p in page_nums:
        for block in blocks_by_page.get(p, []):
            if (block.hsp_page, block.kode_ahsp) in used_blocks:
                continue
            candidates.append(block)
    return candidates


def _should_link_row(row: dict[str, Any]) -> bool:
    """Skip misclassified formular/lampiran tables that are not standard HSP breakdown."""
    if _l01_from_hsp_row(row) is not None:
        return True
    sections = set(row.get("sections") or [])
    if "A" not in sections or row.get("harga_satuan_pekerjaan") is None:
        return False
    return any(
        (c.get("uraian") or "").lower().startswith("pekerja")
        for c in row.get("coefficients", [])
        if c.get("section") == "A"
    )


def _linkable_for_formular(row: dict[str, Any]) -> bool:
    """HSP rows eligible for BM formular linking (includes equipment-only breakdowns)."""
    if _should_link_row(row):
        return True
    sections = set(row.get("sections") or [])
    if not sections & {"A", "B", "C", "D", "E", "F"}:
        return False
    if row.get("harga_satuan_pekerjaan") is not None:
        return True
    coefs = row.get("coefficients") or []
    return bool(coefs) and any(c.get("koefisien") is not None for c in coefs)


def _row_covers_hsp_page(
    row: dict[str, Any],
    hsp_page: int,
    page_map: dict[int, tuple[int, int]],
    *,
    slack: int = 10,
) -> bool:
    pages = page_map.get(row["table_index"])
    if not pages:
        return False
    if pages[0] <= hsp_page <= pages[1]:
        return True
    mid = pages[0] if pages[0] == pages[1] else (pages[0] + pages[1]) // 2
    return abs(mid - hsp_page) <= slack


def block_has_extracted_hsp(
    block: FormularBlock,
    linkable_rows: list[dict[str, Any]],
    page_map: dict[int, tuple[int, int]],
) -> bool:
    return any(_row_covers_hsp_page(row, block.hsp_page, page_map) for row in linkable_rows)


def count_blocks_without_extracted_hsp(
    blocks: list[FormularBlock],
    linkable_rows: list[dict[str, Any]],
    page_map: dict[int, tuple[int, int]],
) -> int:
    """Formular blocks with no linkable HSP row near the formular HSP page in extract."""
    return sum(
        1 for block in blocks if not block_has_extracted_hsp(block, linkable_rows, page_map)
    )


def write_formular_canonical_hsp(
    linked: list[dict[str, Any]],
    blocks: list[FormularBlock],
    output_path: Path,
) -> list[dict[str, Any]]:
    """One linked HSP row per formular block (for full-check / export)."""
    by_key = {
        (int(r["kode_link_page"]), r["kode_ahsp"]): r
        for r in linked
        if r.get("kode_ahsp") and r.get("kode_link_page") is not None
    }
    canonical: list[dict[str, Any]] = []
    for block in blocks:
        row = by_key.get((block.hsp_page, block.kode_ahsp))
        if row is not None:
            canonical.append(row)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        for row in canonical:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    return canonical


def link_hsp_via_formulars(
    hsp_parsed_path: Path,
    blocks: list[FormularBlock],
    *,
    page_map: dict[int, tuple[int, int]] | None = None,
) -> list[dict[str, Any]]:
    """Assign kode_ahsp using formular HSP page + L01 fingerprint within batch."""
    from collections import defaultdict

    hsp_rows = [json.loads(line) for line in hsp_parsed_path.read_text(encoding="utf-8").splitlines()]
    blocks_by_page: dict[int, list[FormularBlock]] = defaultdict(list)
    for block in blocks:
        blocks_by_page[block.hsp_page].append(block)
    used_blocks: set[tuple[int, str]] = set()
    linked_by_index: dict[int, dict[str, Any]] = {}

    def _assign(row: dict[str, Any], block: FormularBlock, method: str) -> None:
        used_blocks.add((block.hsp_page, block.kode_ahsp))
        tidx = row["table_index"]
        out = dict(row)
        out["kode_ahsp"] = block.kode_ahsp
        out["kode_link_method"] = method
        out["kode_link_page"] = block.hsp_page
        out["uraian_item"] = block.uraian
        out["formular_title_page"] = block.title_page
        pages = page_map.get(tidx) if page_map else None
        if pages:
            out["page_range"] = f"{pages[0]}-{pages[1]}"
        linked_by_index[tidx] = out

    linkable = sorted(
        [r for r in hsp_rows if _linkable_for_formular(r)],
        key=lambda r: r["table_index"],
    )

    def _row_page_mid(row: dict[str, Any]) -> int | None:
        if not page_map:
            return None
        pages = page_map.get(row["table_index"])
        if not pages:
            return None
        return pages[0] if pages[0] == pages[1] else (pages[0] + pages[1]) // 2

    rows_on_hsp_page: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in linkable:
        mid = _row_page_mid(row)
        if mid is not None:
            rows_on_hsp_page[mid].append(row)

    for block in sorted(blocks, key=lambda b: b.hsp_page):
        if (block.hsp_page, block.kode_ahsp) in used_blocks:
            continue
        cands = [
            r
            for r in rows_on_hsp_page.get(block.hsp_page, [])
            if r["table_index"] not in linked_by_index
        ]
        if not cands:
            continue
        chosen_row: dict[str, Any] | None = None
        method: str | None = None
        if len(cands) == 1:
            chosen_row, method = cands[0], "formular_hsp_page"
        elif block.l01_koef is not None:
            l01_hits = [
                r
                for r in cands
                if _l01_from_hsp_row(r) is not None
                and _l01_close(_l01_from_hsp_row(r), block.l01_koef)
            ]
            if len(l01_hits) == 1:
                chosen_row, method = l01_hits[0], "formular_hsp_page_l01"
            elif l01_hits:
                chosen_row = max(l01_hits, key=lambda r: len(r.get("coefficients") or []))
                method = "formular_hsp_page_l01_best"
        if chosen_row is not None and method is not None:
            _assign(chosen_row, block, method)

    def _pick_block(
        row: dict[str, Any],
        candidates: list[FormularBlock],
        pages: tuple[int, int] | None,
        *,
        method_prefix: str,
    ) -> tuple[FormularBlock | None, str | None]:
        if not candidates:
            return None, None
        l01 = _l01_from_hsp_row(row)
        chosen: FormularBlock | None = None
        method = f"{method_prefix}_page"

        if l01 is not None:
            l01_hits = [
                b for b in candidates if b.l01_koef is not None and _l01_close(b.l01_koef, l01)
            ]
            if len(l01_hits) == 1:
                return l01_hits[0], f"{method_prefix}_l01_unique"
            if len(l01_hits) > 1 and pages:
                mid = (pages[0] + pages[1]) // 2
                return min(l01_hits, key=lambda b: abs(b.hsp_page - mid)), f"{method_prefix}_l01_nearest"

        if len(candidates) == 1:
            return candidates[0], f"{method_prefix}_page_unique"

        if pages:
            mid = (pages[0] + pages[1]) // 2
            return min(candidates, key=lambda b: abs(b.hsp_page - mid)), f"{method_prefix}_page_nearest"
        return candidates[0], f"{method_prefix}_page_nearest"

    for row in linkable:
        pages = page_map.get(row["table_index"]) if page_map else None
        candidates = _candidate_blocks(
            blocks_by_page,
            _search_page_range(pages, expand=0),
            used_blocks,
        )
        chosen, method = _pick_block(row, candidates, pages, method_prefix="formular")
        if chosen is not None and method is not None:
            _assign(row, chosen, method)

    for row in linkable:
        if row["table_index"] in linked_by_index:
            continue
        pages = page_map.get(row["table_index"]) if page_map else None
        candidates = _candidate_blocks(
            blocks_by_page,
            _search_page_range(pages, expand=_PAGE_EXPAND),
            used_blocks,
        )
        chosen, method = _pick_block(row, candidates, pages, method_prefix="formular_expand")
        if chosen is not None and method is not None:
            _assign(row, chosen, method)

    by_batch: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for row in linkable:
        if row["table_index"] in linked_by_index:
            continue
        pages = page_map.get(row["table_index"]) if page_map else None
        if pages and _l01_from_hsp_row(row) is not None:
            by_batch[pages].append(row)

    for pages, rows in by_batch.items():
        rows.sort(key=lambda r: r["table_index"])
        avail: list[FormularBlock] = []
        for p in _search_page_range(pages, expand=_PAGE_EXPAND):
            for block in blocks_by_page.get(p, []):
                if (block.hsp_page, block.kode_ahsp) not in used_blocks:
                    avail.append(block)
        avail.sort(key=lambda b: b.hsp_page)
        for row, block in zip(rows, avail):
            if row["table_index"] in linked_by_index:
                continue
            _assign(row, block, "formular_batch_sequential")

    rows_by_mid: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in linkable:
        if row["table_index"] in linked_by_index:
            continue
        mid = _row_page_mid(row)
        if mid is not None:
            rows_by_mid[mid].append(row)

    for block in sorted(blocks, key=lambda b: b.hsp_page):
        if (block.hsp_page, block.kode_ahsp) in used_blocks:
            continue
        cands: list[dict[str, Any]] = []
        for offset in range(-5, 6):
            cands.extend(rows_by_mid.get(block.hsp_page + offset, []))
        cands = [r for r in cands if r["table_index"] not in linked_by_index]
        if not cands:
            continue
        if len(cands) == 1:
            _assign(cands[0], block, "formular_mid_near_unique")
            continue
        if block.l01_koef is not None:
            l01_hits = [
                r
                for r in cands
                if _l01_from_hsp_row(r) is not None
                and _l01_close(_l01_from_hsp_row(r), block.l01_koef)
            ]
            if len(l01_hits) == 1:
                _assign(l01_hits[0], block, "formular_mid_near_l01")
            elif l01_hits:
                _assign(
                    max(l01_hits, key=lambda r: len(r.get("coefficients") or [])),
                    block,
                    "formular_mid_near_l01_best",
                )

    for block in sorted(blocks, key=lambda b: b.hsp_page):
        if (block.hsp_page, block.kode_ahsp) in used_blocks:
            continue
        if block.l01_koef is None:
            continue
        hits = [
            r
            for r in linkable
            if r["table_index"] not in linked_by_index
            and _l01_from_hsp_row(r) is not None
            and _l01_close(_l01_from_hsp_row(r), block.l01_koef)
        ]
        if len(hits) == 1:
            _assign(hits[0], block, "formular_l01_global_unique")
        elif hits:
            _assign(
                min(hits, key=lambda r: abs((_row_page_mid(r) or block.hsp_page) - block.hsp_page)),
                block,
                "formular_l01_global_nearest",
            )

    for block in sorted(blocks, key=lambda b: b.hsp_page):
        if (block.hsp_page, block.kode_ahsp) in used_blocks:
            continue
        cands = []
        for row in linkable:
            if row["table_index"] in linked_by_index:
                continue
            if page_map and _row_covers_hsp_page(row, block.hsp_page, page_map):
                cands.append(row)
        if len(cands) == 1:
            _assign(cands[0], block, "formular_batch_window_unique")
            continue
        if len(cands) > 1 and block.l01_koef is not None:
            l01_hits = [
                r
                for r in cands
                if _l01_from_hsp_row(r) is not None
                and _l01_close(_l01_from_hsp_row(r), block.l01_koef)
            ]
            if len(l01_hits) == 1:
                _assign(l01_hits[0], block, "formular_batch_window_l01_unique")

    for block in sorted(blocks, key=lambda b: b.hsp_page):
        if (block.hsp_page, block.kode_ahsp) in used_blocks:
            continue
        tight: list[dict[str, Any]] = []
        for row in linkable:
            if row["table_index"] in linked_by_index:
                continue
            mid = _row_page_mid(row)
            if mid is not None and abs(mid - block.hsp_page) <= 3:
                tight.append(row)
        if len(tight) == 1:
            _assign(tight[0], block, "formular_tight_page_unique")
            continue
        if len(tight) > 1 and block.l01_koef is not None:
            l01_hits = [
                r
                for r in tight
                if _l01_from_hsp_row(r) is not None
                and _l01_close(_l01_from_hsp_row(r), block.l01_koef)
            ]
            if len(l01_hits) == 1:
                _assign(l01_hits[0], block, "formular_tight_page_l01_unique")

    for block in sorted(blocks, key=lambda b: b.hsp_page):
        if (block.hsp_page, block.kode_ahsp) in used_blocks:
            continue
        best_row: dict[str, Any] | None = None
        best_dist = 10_000
        for row in linkable:
            if row["table_index"] in linked_by_index:
                continue
            mid = _row_page_mid(row)
            if mid is None:
                continue
            dist = abs(mid - block.hsp_page)
            if dist > 25:
                continue
            if block.l01_koef is not None:
                row_l01 = _l01_from_hsp_row(row)
                if row_l01 is None or not _l01_close(row_l01, block.l01_koef):
                    continue
            if dist < best_dist:
                best_dist = dist
                best_row = row
        if best_row is not None:
            _assign(best_row, block, "formular_distance_nearest")

    blocks_by_key = {(b.hsp_page, b.kode_ahsp): b for b in blocks}

    def _unassign_block(block_key: tuple[int, str]) -> None:
        used_blocks.discard(block_key)
        for tidx, out in list(linked_by_index.items()):
            if (int(out["kode_link_page"]), out["kode_ahsp"]) == block_key:
                del linked_by_index[tidx]
                return

    for _ in range(4):
        improved = False
        for block in sorted(blocks, key=lambda b: b.hsp_page):
            block_key = (block.hsp_page, block.kode_ahsp)
            if block_key in used_blocks:
                continue
            best_tidx: int | None = None
            best_my_dist = 10_000
            best_steal_other: tuple[int, str] | None = None
            for row in linkable:
                tidx = row["table_index"]
                mid = _row_page_mid(row)
                if mid is None or abs(mid - block.hsp_page) > 4:
                    continue
                my_dist = abs(mid - block.hsp_page)
                if tidx not in linked_by_index:
                    if my_dist < best_my_dist:
                        best_my_dist = my_dist
                        best_tidx = tidx
                        best_steal_other = None
                    continue
                out = linked_by_index[tidx]
                other_key = (int(out["kode_link_page"]), out["kode_ahsp"])
                other = blocks_by_key.get(other_key)
                if other is None:
                    continue
                their_dist = abs(mid - other.hsp_page)
                if my_dist + 1 < their_dist and my_dist < best_my_dist:
                    best_my_dist = my_dist
                    best_tidx = tidx
                    best_steal_other = other_key
            if best_tidx is None:
                continue
            if best_steal_other is not None:
                _unassign_block(best_steal_other)
            row = next(r for r in linkable if r["table_index"] == best_tidx)
            method = (
                "formular_rebalance_steal"
                if best_steal_other is not None
                else "formular_rebalance_open"
            )
            _assign(row, block, method)
            improved = True
        if not improved:
            break

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
        out["formular_title_page"] = None
        pages = page_map.get(tidx) if page_map else None
        if pages:
            out["page_range"] = f"{pages[0]}-{pages[1]}"
        linked.append(out)

    return linked


def run_formular_link(
    *,
    pdf_path: Path,
    hsp_parsed_path: Path,
    checkpoint_dir: Path,
    output_path: Path,
    page_start: int = 1,
    page_end: int | None = None,
    cache_path: Path | None = None,
) -> dict[str, Any]:
    """Build page index, extract formular blocks, link HSP tables."""
    cache = cache_path or output_path.with_name("pdf-page-index.json")
    print(f"Building page index (cache: {cache.name})…", flush=True)
    page_index = build_page_index(
        pdf_path,
        page_start=page_start,
        page_end=page_end,
        cache_path=cache,
    )

    blocks = extract_formular_blocks(page_index)
    print(f"Formular blocks: {len(blocks)}", flush=True)

    blocks_path = output_path.with_name("formular-blocks.json")
    blocks_path.write_text(
        json.dumps(
            [
                {
                    "kode_ahsp": b.kode_ahsp,
                    "uraian": b.uraian,
                    "title_page": b.title_page,
                    "hsp_page": b.hsp_page,
                    "l01_koef": b.l01_koef,
                }
                for b in blocks
            ],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    page_map = build_table_page_map(checkpoint_dir)
    hsp_preview = [
        json.loads(line)
        for line in hsp_parsed_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    linkable_preview = [r for r in hsp_preview if _linkable_for_formular(r)]
    page_map = refine_page_map_for_hsp_rows(page_map, linkable_preview, pdf_path)
    linked = link_hsp_via_formulars(hsp_parsed_path, blocks, page_map=page_map)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        for row in linked:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")

    with_kode = sum(1 for r in linked if r.get("kode_ahsp"))
    linkable_count = sum(1 for r in linked if _should_link_row(r))
    linked_eligible = sum(1 for r in linked if r.get("kode_ahsp") and _should_link_row(r))
    high_conf = sum(
        1
        for r in linked
        if r.get("kode_link_method")
        in (
            "formular_l01_unique",
            "formular_page_unique",
            "formular_hsp_page",
            "formular_hsp_page_l01",
            "formular_hsp_page_l01_best",
            "formular_mid_near_unique",
            "formular_mid_near_l01",
            "formular_mid_near_l01_best",
            "formular_l01_global_unique",
            "formular_l01_global_nearest",
            "formular_batch_window_unique",
            "formular_rebalance_steal",
            "formular_rebalance_open",
        )
    )
    linked_block_keys = {
        (int(r["kode_link_page"]), r["kode_ahsp"])
        for r in linked
        if r.get("kode_ahsp") and r.get("kode_link_page") is not None
    }
    blocks_linked = sum(1 for b in blocks if (b.hsp_page, b.kode_ahsp) in linked_block_keys)
    blocks_without_extract = count_blocks_without_extracted_hsp(blocks, linkable_preview, page_map)
    blocks_with_extracted = len(blocks) - blocks_without_extract
    blocks_linked_with_extract = sum(
        1
        for b in blocks
        if (b.hsp_page, b.kode_ahsp) in linked_block_keys
        and block_has_extracted_hsp(b, linkable_preview, page_map)
    )

    import pypdfium2 as pdfium

    pdf_doc = pdfium.PdfDocument(str(pdf_path))
    page_text_cache: dict[int, str] = {}
    eligible_blocks = 0
    template_blocks = 0
    for block in blocks:
        if block.hsp_page not in page_text_cache:
            page_text_cache[block.hsp_page] = _read_pdf_page_text(pdf_doc, block.hsp_page)
        if formular_block_expects_hsp_table(page_text_cache[block.hsp_page]):
            eligible_blocks += 1
        else:
            template_blocks += 1

    summary = {
        "mode": "formular",
        "pages_indexed": len(page_index),
        "formular_blocks": len(blocks),
        "hsp_tables": len(linked),
        "linkable_hsp": linkable_count,
        "linked": with_kode,
        "linked_eligible": linked_eligible,
        "link_rate_pct": round(100 * with_kode / len(linked), 1) if linked else 0,
        "link_rate_eligible_pct": round(100 * linked_eligible / linkable_count, 1)
        if linkable_count
        else 0,
        "high_confidence_links": high_conf,
        "formular_blocks_linked": blocks_linked,
        "formular_block_link_rate_pct": round(100 * blocks_linked / len(blocks), 1) if blocks else 0,
        "formular_blocks_eligible": eligible_blocks,
        "formular_blocks_template": template_blocks,
        "formular_block_link_rate_on_eligible_pct": round(100 * blocks_linked / eligible_blocks, 1)
        if eligible_blocks
        else 0,
        "formular_blocks_without_extracted_hsp": blocks_without_extract,
        "formular_blocks_with_extracted_hsp": blocks_with_extracted,
        "formular_blocks_linked_with_extract": blocks_linked_with_extract,
        "formular_block_link_rate_with_extract_pct": round(
            100 * blocks_linked_with_extract / blocks_with_extracted, 1
        )
        if blocks_with_extracted
        else 0,
        "output": str(output_path),
        "formular_blocks_path": str(blocks_path),
        "page_index_cache": str(cache),
    }

    summary_path = output_path.with_name("kode-link-summary.json")
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    canonical_path = output_path.with_name("hsp-parsed-formular-canonical.jsonl")
    canonical_rows = write_formular_canonical_hsp(linked, blocks, canonical_path)
    summary["canonical_hsp_tables"] = len(canonical_rows)
    summary["canonical_hsp_path"] = str(canonical_path)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    map_path = output_path.with_name("kode-table-map.csv")
    import csv as csv_mod

    with map_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv_mod.DictWriter(
            fh,
            fieldnames=[
                "table_index",
                "table_csv",
                "kode_ahsp",
                "uraian_item",
                "hsp_page",
                "title_page",
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
                    "hsp_page": row.get("kode_link_page", ""),
                    "title_page": row.get("formular_title_page", ""),
                    "page_range": row.get("page_range", ""),
                    "link_method": row.get("kode_link_method", ""),
                    "harga_satuan_pekerjaan": row.get("harga_satuan_pekerjaan", ""),
                }
            )

    summary["kode_table_map"] = str(map_path)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary
