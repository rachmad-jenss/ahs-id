"""Spot-check / full-check extracted HSP tables against PDF source text."""

from __future__ import annotations

import json
import random
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ahs_id.table_clean import parse_id_number


@dataclass
class SpotCheckItem:
    table_index: int
    page_estimate: int | None
    page_range: str | None
    coefficients: list[dict[str, Any]]
    harga_satuan_pekerjaan: float | None
    checks: list[dict[str, str]] = field(default_factory=list)
    verdict: str = "pending"  # pass | fail | partial


def build_table_page_map(
    checkpoint_dir: Path,
    *,
    chunk_size: int | None = 10,
) -> dict[int, tuple[int, int]]:
    """
    Map global table index → (page_start, page_end) batch from checkpoints.

    When extract was resumed with a different ``--chunk-size``, orphan checkpoint
    files can exist; we keep one batch per ``page_start`` (largest table count)
    and optionally filter to a fixed span (default 10 pages, SE 47 full runs).
    """
    import re

    by_start: dict[int, tuple[int, int, int]] = {}
    for ckpt_path in checkpoint_dir.glob("batch-*.json"):
        m = re.match(r"batch-(\d+)-(\d+)\.json$", ckpt_path.name)
        if not m:
            continue
        page_start = int(m.group(1))
        page_end = int(m.group(2))
        span = page_end - page_start + 1
        if chunk_size is not None and span != chunk_size:
            continue
        try:
            data = json.loads(ckpt_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        n_tables = len(data.get("tables", []))
        prev = by_start.get(page_start)
        if prev is None or n_tables > prev[2]:
            by_start[page_start] = (page_start, page_end, n_tables)

    mapping: dict[int, tuple[int, int]] = {}
    global_idx = 0
    for page_start in sorted(by_start):
        page_start, page_end, _ = by_start[page_start]
        ckpt_path = checkpoint_dir / f"batch-{page_start:06d}-{page_end:06d}.json"
        if not ckpt_path.is_file():
            continue
        data = json.loads(ckpt_path.read_text(encoding="utf-8"))
        for tbl in data.get("tables", []):
            page_no = tbl.get("page_no") if isinstance(tbl, dict) else None
            estimated = bool(isinstance(tbl, dict) and tbl.get("page_estimate"))
            if isinstance(page_no, int) and page_no > 0 and not estimated:
                mapping[global_idx] = (page_no, page_no)
            else:
                mapping[global_idx] = (page_start, page_end)
            global_idx += 1

    return mapping


def _l01_koef_from_row(row: dict[str, Any]) -> float | None:
    for coef in row.get("coefficients", []):
        kode = coef.get("kode") or ""
        uraian = (coef.get("uraian") or "").lower()
        if (
            kode in {"L.01", "L01"}
            or re.search(r"l\.?01", kode, re.I)
            or re.search(r"l\.?01", uraian)
        ):
            val = coef.get("koefisien")
            return float(val) if val is not None else None
        if not kode and uraian.startswith("pekerja"):
            val = coef.get("koefisien")
            return float(val) if val is not None else None
    return None


def guess_table_page_in_range(
    row: dict[str, Any],
    page_range: tuple[int, int],
    cache: _PdfPageCache,
) -> int | None:
    """Pick the PDF page within *page_range* that best matches HSP row coefficients."""
    l01 = _l01_koef_from_row(row)
    hsp_total = row.get("harga_satuan_pekerjaan")
    coefs = row.get("coefficients", [])[:5]

    best_page: int | None = None
    best_score = 0
    for page_num in range(page_range[0], page_range[1] + 1):
        text = cache.get(page_num)
        score = 0
        if l01 is not None and _find_in_text(text, _float_variants(float(l01))):
            score += 4
        if hsp_total is not None and _find_in_text(text, _idr_variants(float(hsp_total))):
            score += 3
        for coef in coefs:
            val = coef.get("koefisien")
            if val is None:
                continue
            if _find_in_text(text, _float_variants(float(val))):
                score += 1
        if score > best_score:
            best_score = score
            best_page = page_num

    return best_page if best_score >= 2 else None


_SDA_REFINE_PAGE_SLACK = 3


def refine_page_map_for_hsp_rows(
    page_map: dict[int, tuple[int, int]],
    rows: list[dict[str, Any]],
    pdf_path: Path,
    *,
    refine_point_pages: bool = True,
) -> dict[int, tuple[int, int]]:
    """Narrow batch ranges (or ±slack around a point page) via PDF coefficient match."""
    cache = _PdfPageCache(pdf_path)
    refined = dict(page_map)
    for row in rows:
        tidx = int(row["table_index"])
        pages = page_map.get(tidx)
        if not pages:
            continue
        if pages[0] == pages[1]:
            if not refine_point_pages:
                continue
            p = pages[0]
            search = (max(1, p - _SDA_REFINE_PAGE_SLACK), p + _SDA_REFINE_PAGE_SLACK)
        else:
            search = pages
        guess = guess_table_page_in_range(row, search, cache)
        if guess is not None:
            refined[tidx] = (guess, guess)
    return refined


def load_link_pages(hsp_parsed_path: Path) -> dict[int, int]:
    """table_index → kode_link_page from sibling hsp-linked.jsonl when present."""
    linked = hsp_parsed_path.with_name("hsp-linked.jsonl")
    if not linked.is_file():
        return {}
    out: dict[int, int] = {}
    for line in linked.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        page = row.get("kode_link_page")
        if page is not None:
            out[int(row["table_index"])] = int(page)
    return out


def extract_pdf_page_text(pdf_path: Path, page_num: int) -> str:
    """Extract plain text from a 1-based PDF page (opens PDF each call — prefer PdfPageCache)."""
    return _PdfPageCache(pdf_path).get(page_num)


class _PdfPageCache:
    """Lazy page-text cache; one PdfDocument handle per path."""

    _docs: dict[str, Any] = {}
    _pages: dict[tuple[str, int], str] = {}

    def __init__(self, pdf_path: Path) -> None:
        self._key = str(pdf_path.resolve())

    def _doc(self) -> Any:
        import pypdfium2 as pdfium

        if self._key not in self._docs:
            self._docs[self._key] = pdfium.PdfDocument(self._key)
        return self._docs[self._key]

    def get(self, page_num: int) -> str:
        cache_key = (self._key, page_num)
        if cache_key in self._pages:
            return self._pages[cache_key]

        pdf = self._doc()
        if page_num < 1 or page_num > len(pdf):
            text = ""
        else:
            page = pdf[page_num - 1]
            textpage = page.get_textpage()
            text = textpage.get_text_range(0, textpage.count_chars()).replace("\u00a0", " ")
        self._pages[cache_key] = text
        return text

    def get_range(self, page_start: int, page_end: int) -> str:
        parts = [self.get(p) for p in range(page_start, page_end + 1)]
        return "\n".join(parts)


def _format_idr_indonesian(value: float, *, decimals: int = 2) -> str:
    """94286.86 → '94.286,86'; 1301.9614 → '1.301,9614'."""
    if decimals == 2:
        scaled = round(value * 100)
        whole = scaled // 100
        frac = scaled % 100
        body = f"{whole:,}".replace(",", ".")
        return f"{body},{frac:02d}" if frac else body

    text = f"{value:.{decimals}f}".rstrip("0").rstrip(".")
    if "." in text:
        whole_s, frac_s = text.split(".", 1)
        whole = int(whole_s)
        body = f"{whole:,}".replace(",", ".")
        return f"{body},{frac_s}"
    whole = int(round(value))
    return f"{whole:,}".replace(",", ".")


def _float_variants(value: float) -> list[str]:
    variants: set[str] = set()
    variants.add(f"{value:g}")
    for places in (2, 3, 4, 5, 6):
        dotted = f"{value:.{places}f}".rstrip("0").rstrip(".")
        if dotted:
            variants.add(dotted)
            variants.add(dotted.replace(".", ","))
    if value < 10:
        variants.add(f"{value:.4f}".replace(".", ",").rstrip("0").rstrip(","))
        variants.add(f"{value:.3f}".replace(".", ",").rstrip("0").rstrip(","))
    elif value < 100:
        for places in (2, 3, 4):
            variants.add(f"{value:.{places}f}".replace(".", ","))
    if value >= 1000:
        variants.add(_format_idr_indonesian(value, decimals=2))
        for d in (1, 3, 4):
            variants.add(_format_idr_indonesian(value, decimals=d))
        int_part = int(round(value))
        variants.add(f"{int_part:,}".replace(",", "."))
        variants.add(f"{int_part:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
    return sorted(variants, key=len, reverse=True)


def _idr_variants(value: float) -> list[str]:
    """IDR display forms: 6359.5 → 6.359,50; 94286.86 → 94.286,86."""
    variants: set[str] = set()
    whole = int(value)
    cents = round((value - whole) * 100)
    if cents:
        variants.add(f"{whole:,}".replace(",", ".") + f",{cents:02d}")
        variants.add(f"{whole:,}".replace(",", ".") + f",{cents}")
    variants.add(f"{whole:,}".replace(",", "."))
    variants.add(str(whole))
    variants.add(_format_idr_indonesian(value, decimals=2))
    variants.add(_format_idr_indonesian(value, decimals=4))
    variants.add(_format_idr_indonesian(value, decimals=3))
    # Trailing-digit tolerance (PDF rounding)
    variants.add(_format_idr_indonesian(round(value, 2), decimals=2))
    return sorted(variants, key=len, reverse=True)


def _find_in_text(text: str, patterns: list[str]) -> bool:
    normalized = text.replace("\u00a0", " ")
    for pat in patterns:
        if pat and pat in normalized:
            return True
        # comma/dot swap attempt
        alt = pat.replace(",", ".") if "," in pat else pat.replace(".", ",")
        if alt in normalized:
            return True
    return False


def verify_item_against_pdf(
    item: SpotCheckItem,
    pdf_text: str,
) -> SpotCheckItem:
    """Check coefficients and HSP total appear in PDF page text."""
    checks: list[dict[str, str]] = []
    passed = 0
    total = 0

    for coef in item.coefficients[:6]:  # cap per table
        total += 1
        val = coef.get("koefisien")
        ref = coef.get("kode") or coef.get("uraian") or ""
        if val is None:
            checks.append({"field": ref, "status": "skip", "detail": "no value"})
            continue
        patterns = _float_variants(float(val))
        ref_ok = ref in pdf_text if ref else True
        val_ok = _find_in_text(pdf_text, patterns)
        if ref_ok and val_ok:
            passed += 1
            checks.append({"field": ref, "status": "pass", "detail": f"koef {patterns[0]} found"})
        elif val_ok:
            passed += 1
            checks.append({"field": ref, "status": "pass", "detail": f"value {patterns[0]} found (ref not on page)"})
        else:
            checks.append({"field": ref, "status": "fail", "detail": f"koef {patterns} not in PDF text"})

    if item.harga_satuan_pekerjaan is not None:
        total += 1
        hsp_patterns = _idr_variants(item.harga_satuan_pekerjaan)
        if _find_in_text(pdf_text, hsp_patterns):
            passed += 1
            checks.append({"field": "HSP_total", "status": "pass", "detail": f"total ~{item.harga_satuan_pekerjaan}"})
        else:
            checks.append({"field": "HSP_total", "status": "fail", "detail": f"total {hsp_patterns[:3]} not found"})

    if passed == total and total > 0:
        item.verdict = "pass"
    elif passed >= total * 0.6 and passed > 0:
        item.verdict = "partial"
    else:
        item.verdict = "fail"

    item.checks = checks
    return item


def _item_to_report_dict(item: SpotCheckItem) -> dict[str, Any]:
    return {
        "table_index": item.table_index,
        "csv": f"table-{item.table_index + 1:04d}.csv",
        "page_estimate": item.page_estimate,
        "page_range": item.page_range,
        "harga_satuan_pekerjaan": item.harga_satuan_pekerjaan,
        "verdict": item.verdict,
        "coefficients_checked": len(item.coefficients[:6]),
        "checks": item.checks,
    }


def _load_full_check_progress(progress_path: Path) -> dict[str, Any] | None:
    if not progress_path.is_file():
        return None
    try:
        return json.loads(progress_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _save_full_check_progress(progress_path: Path, state: dict[str, Any]) -> None:
    progress_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = progress_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(progress_path)


def _progress_matches(
    saved: dict[str, Any],
    *,
    pdf_path: Path,
    hsp_parsed_path: Path,
) -> bool:
    return (
        saved.get("pdf") == str(pdf_path)
        and saved.get("hsp_parsed") == str(hsp_parsed_path)
        and saved.get("mode") == "full"
    )


def run_spot_check(
    *,
    hsp_parsed_path: Path,
    checkpoint_dir: Path,
    pdf_path: Path,
    output_path: Path,
    sample_size: int = 25,
    seed: int = 42,
    full: bool = False,
    include_passes: bool = False,
    progress_every: int = 100,
    checkpoint_every: int = 25,
    resume: bool = True,
    progress_path: Path | None = None,
    log_fn: Any | None = None,
) -> dict[str, Any]:
    """Verify HSP tables against PDF source pages (sample or full, resumable)."""
    _log = log_fn or (lambda msg: None)

    lines = hsp_parsed_path.read_text(encoding="utf-8").splitlines()
    all_rows = [json.loads(line) for line in lines]

    candidates = [
        r
        for r in all_rows
        if r.get("coefficients")
        and not any(i.get("severity") == "error" for i in r.get("issues", []))
    ]
    with_totals = [r for r in candidates if r.get("harga_satuan_pekerjaan")]
    pool = with_totals if with_totals else candidates
    link_pages = load_link_pages(hsp_parsed_path)

    if full:
        sample = sorted(candidates, key=lambda r: r["table_index"])
        mode = "full"
    else:
        rng = random.Random(seed)
        sample = sorted(
            rng.sample(pool, min(sample_size, len(pool))),
            key=lambda r: r["table_index"],
        )
        mode = "sample"

    page_map = build_table_page_map(checkpoint_dir)
    page_cache = _PdfPageCache(pdf_path)
    pdf_page_count = len(page_cache._doc())
    total = len(sample)

    completed: set[int] = set()
    verdicts: dict[str, str] = {}
    stored_items: list[dict[str, Any]] = []
    ckpt_path = progress_path or output_path.with_name("full-check-progress.json")

    if full and resume:
        saved = _load_full_check_progress(ckpt_path)
        if saved and _progress_matches(saved, pdf_path=pdf_path, hsp_parsed_path=hsp_parsed_path):
            completed = {int(k) for k in saved.get("verdicts", {})}
            verdicts = {str(k): v for k, v in saved.get("verdicts", {}).items()}
            stored_items = list(saved.get("items", []))
            if saved.get("status") == "done" and len(completed) >= total:
                _log(f"  resume: already complete ({len(completed)}/{total})")
        elif saved and not resume:
            _log("  --no-resume: starting fresh")

    if full and resume and completed:
        _log(f"  resume: {len(completed)}/{total} tables already verified")

    state: dict[str, Any] = {
        "status": "in_progress",
        "mode": mode,
        "pdf": str(pdf_path),
        "hsp_parsed": str(hsp_parsed_path),
        "total": total,
        "pool_size": len(candidates),
        "with_hsp_total": len(with_totals),
        "verdicts": verdicts,
        "items": stored_items,
    }
    _save_full_check_progress(ckpt_path, state)

    done_since_ckpt = 0
    for i, row in enumerate(sample, start=1):
        tidx = row["table_index"]
        if tidx in completed:
            continue

        if progress_every and (len(completed) + 1) % progress_every == 0:
            _log(f"  verified {len(completed) + 1}/{total}...")

        pages = page_map.get(tidx)
        if pages and pages[0] != pages[1]:
            guess = guess_table_page_in_range(row, pages, page_cache)
            if guess is not None:
                pages = (guess, guess)
        page_est = pages[0] if pages else None
        page_range = f"{pages[0]}-{pages[1]}" if pages else None

        item = SpotCheckItem(
            table_index=tidx,
            page_estimate=page_est,
            page_range=page_range,
            coefficients=row["coefficients"],
            harga_satuan_pekerjaan=row.get("harga_satuan_pekerjaan"),
        )

        link_page = link_pages.get(tidx)
        if link_page is not None:
            p_lo = max(1, link_page - 5)
            p_hi = min(pdf_page_count, link_page + 5)
            combined = page_cache.get_range(p_lo, p_hi)
            page_est = link_page
            page_range = f"{p_lo}-{p_hi}"
            item.page_estimate = page_est
            item.page_range = page_range
        elif page_est is None:
            item.verdict = "fail"
            item.checks = [{"field": "page", "status": "fail", "detail": "no page mapping"}]
            completed.add(tidx)
            verdicts[str(tidx)] = item.verdict
            if item.verdict != "pass" or include_passes:
                stored_items.append(_item_to_report_dict(item))
            done_since_ckpt += 1
            continue
        else:
            combined = page_cache.get_range(pages[0], pages[1]) if pages else ""

        if page_est is not None:
            verify_item_against_pdf(item, combined)

        completed.add(tidx)
        verdicts[str(tidx)] = item.verdict
        if item.verdict != "pass" or include_passes:
            stored_items.append(_item_to_report_dict(item))

        done_since_ckpt += 1
        if full and done_since_ckpt >= checkpoint_every:
            state["verdicts"] = verdicts
            state["items"] = stored_items
            state["completed"] = len(completed)
            _save_full_check_progress(ckpt_path, state)
            done_since_ckpt = 0

    pass_n = sum(1 for v in verdicts.values() if v == "pass")
    partial_n = sum(1 for v in verdicts.values() if v == "partial")
    fail_n = sum(1 for v in verdicts.values() if v == "fail")

    summary = {
        "mode": mode,
        "pass": pass_n,
        "partial": partial_n,
        "fail": fail_n,
        "sample_size": len(verdicts),
        "pool_size": len(candidates),
        "with_hsp_total": len(with_totals),
        "pdf": str(pdf_path),
        "resumable": full,
        "progress_file": str(ckpt_path) if full else None,
    }

    if full and not include_passes:
        item_rows = [it for it in stored_items if it["verdict"] != "pass"]
    else:
        item_rows = stored_items

    report = {"summary": summary, "items": item_rows}

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    if full:
        state["status"] = "done"
        state["completed"] = len(completed)
        state["verdicts"] = verdicts
        state["items"] = stored_items
        state["summary"] = summary
        _save_full_check_progress(ckpt_path, state)

    return report
