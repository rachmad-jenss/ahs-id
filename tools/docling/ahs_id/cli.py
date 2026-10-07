#!/usr/bin/env python3
"""CLI for AHS-ID Docling tooling."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ahs_id.bundle import collect_package_coefficients, repo_root
from ahs_id.docling_convert import (
    convert_document,
    count_pdf_pages,
    enrich_checkpoint_page_numbers,
    interpolate_checkpoint_page_estimates,
    write_conversion_artifacts,
)
from ahs_id.kode_link import run_kode_link
from ahs_id.spot_check import run_spot_check
from ahs_id.table_analyze import analyze_and_clean
from ahs_id.verify import MatchStatus, summarize, verify_coefficients_in_text


def _configure_stdio() -> None:
    """Avoid UnicodeEncodeError on Windows consoles."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def _safe_print(message: str) -> None:
    try:
        print(message)
    except UnicodeEncodeError:
        print(message.encode("ascii", errors="replace").decode("ascii"))


def cmd_assign_page_estimates(args: argparse.Namespace) -> int:
    checkpoint_dir = Path(args.checkpoints)
    _safe_print(f"Interpolating per-table page_no in {checkpoint_dir}")
    stats = interpolate_checkpoint_page_estimates(checkpoint_dir)
    _safe_print(json.dumps(stats, indent=2))
    return 0


def cmd_enrich_pages(args: argparse.Namespace) -> int:
    checkpoint_dir = Path(args.checkpoints)
    _safe_print(f"Enriching table page_no: {args.pdf} → {checkpoint_dir}")
    stats = enrich_checkpoint_page_numbers(
        args.pdf,
        checkpoint_dir,
        enable_ocr=args.ocr,
        skip_complete=not args.force,
    )
    _safe_print(json.dumps(stats, indent=2))
    if args.reassemble:
        out_dir = checkpoint_dir.parent
        _safe_print(f"Re-assembling tables JSON under {out_dir}")
        result = convert_document(
            args.pdf,
            enable_ocr=args.ocr,
            chunk_size=args.chunk_size,
            show_progress=not args.no_progress,
            status_path=out_dir / "progress.json",
            checkpoint_dir=checkpoint_dir,
            resume=True,
        )
        write_conversion_artifacts(result, out_dir)
    return 0


def cmd_extract(args: argparse.Namespace) -> int:
    source = args.source
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    pages = count_pdf_pages(source)
    if pages:
        _safe_print(f"PDF: {pages} pages")
        if pages > 100 and not args.page_range:
            chunk = args.chunk_size or (20 if pages > 500 else 15 if pages > 200 else 10)
            batches = (pages + chunk - 1) // chunk
            _safe_print(f"Large document → {batches} batch(es) of ≤{chunk} pages")

    status_path = output_dir / "progress.json"
    if not args.no_progress:
        _safe_print(f"Status file: {status_path}  (tail in another terminal)")

    checkpoint_dir = output_dir / "checkpoints"
    resume = not args.no_resume
    if resume and checkpoint_dir.is_dir():
        done = len(list(checkpoint_dir.glob("batch-*.json")))
        if done:
            _safe_print(f"Resuming: {done} batch(es) already on disk will be skipped")

    from ahs_id.docling_convert import prepare_long_extract_env

    prepare_long_extract_env()
    _safe_print(f"Converting: {source} (ocr={'on' if args.ocr else 'off'})")
    result = convert_document(
        source,
        enable_ocr=args.ocr,
        page_range_spec=args.page_range,
        chunk_size=args.chunk_size,
        show_progress=not args.no_progress,
        status_path=status_path,
        checkpoint_dir=checkpoint_dir,
        resume=resume,
    )
    paths = write_conversion_artifacts(result, output_dir)

    _safe_print(f"Pages converted: {result.page_count or '?'}")
    if result.page_range:
        _safe_print(f"Page range: {result.page_range[0]}–{result.page_range[1]}")
    _safe_print(f"Tables: {len(result.tables)}")
    _safe_print(f"Markdown: {len(result.markdown):,} chars")
    for key, path in paths.items():
        _safe_print(f"  {key}: {path}")

    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    root = Path(args.root) if args.root else repo_root()
    coefficients = collect_package_coefficients(
        args.package,
        kode_filter=args.kode,
        root=root,
    )

    if not coefficients:
        print(f"No coefficients found for package={args.package!r} kode={args.kode!r}", file=sys.stderr)
        return 1

    print(f"Loaded {len(coefficients)} coefficient(s) from @{args.package}")

    if args.markdown:
        text = Path(args.markdown).read_text(encoding="utf-8")
        print(f"Using cached markdown: {args.markdown}")
    else:
        if not args.pdf:
            print("Provide --pdf or --markdown", file=sys.stderr)
            return 1
        print(f"Converting PDF: {args.pdf} (ocr={'on' if args.ocr else 'off'})")
        verify_ckpt = Path(args.pdf).with_suffix("").name + "-checkpoints"
        result = convert_document(
            args.pdf,
            enable_ocr=args.ocr,
            page_range_spec=args.page_range,
            chunk_size=args.chunk_size,
            show_progress=not args.no_progress,
            checkpoint_dir=Path("tools/docling/output") / verify_ckpt,
            resume=not args.no_resume,
        )
        text = result.markdown
        if args.save_markdown:
            out = Path(args.save_markdown)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(text, encoding="utf-8")
            print(f"Saved markdown: {out}")

    rows = verify_coefficients_in_text(coefficients, text)
    counts = summarize(rows)

    print()
    print("Layer 1 verification summary:")
    for status, count in counts.items():
        print(f"  {status}: {count}")

    failures = [r for r in rows if r.status != MatchStatus.FOUND]
    if failures:
        print()
        print("Issues:")
        for row in failures:
            c = row.coefficient
            label = c.ref or c.name or c.component
            print(f"  [{row.status.value}] {c.kode_ahsp} {label}={c.value} — {row.detail}")

    if args.json_report:
        report_path = Path(args.json_report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "package": args.package,
            "kode_filter": args.kode,
            "summary": counts,
            "rows": [
                {
                    "kode_ahsp": r.coefficient.kode_ahsp,
                    "component": r.coefficient.component,
                    "ref": r.coefficient.ref,
                    "value": r.coefficient.value,
                    "status": r.status.value,
                    "detail": r.detail,
                }
                for r in rows
            ],
        }
        report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nReport: {report_path}")

    if args.strict and counts.get(MatchStatus.NOT_FOUND.value, 0) > 0:
        return 2
    if args.strict and counts.get(MatchStatus.AMBIGUOUS.value, 0) > 0:
        return 3
    return 0


def cmd_analyze(args: argparse.Namespace) -> int:
    tables_path = Path(args.tables)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    _safe_print(f"Analyzing: {tables_path}")
    manifest = analyze_and_clean(
        tables_path,
        output_dir,
        write_by_type=not args.no_by_type,
    )

    _safe_print(f"Tables: {manifest.source_tables}")
    _safe_print("Categories:")
    for cat, count in sorted(manifest.categories.items()):
        _safe_print(f"  {cat}: {count}")
    _safe_print(
        f"HSP breakdown: {manifest.hsp_verified} ok, "
        f"{manifest.hsp_with_issues} with errors"
    )
    _safe_print(
        f"Item index: {manifest.index_items} rows, "
        f"{manifest.unique_index_codes} unique codes"
    )
    errors = sum(1 for i in manifest.issues if i.severity == "error")
    warns = sum(1 for i in manifest.issues if i.severity == "warn")
    _safe_print(f"Issues: {errors} errors, {warns} warnings")
    _safe_print(f"Output: {output_dir / 'manifest.json'}")
    return 2 if args.strict and errors else 0


def cmd_spot_check(args: argparse.Namespace) -> int:
    hsp_path = Path(args.hsp_parsed)
    ckpt_dir = Path(args.checkpoints)
    pdf_path = Path(args.pdf)
    output_path = Path(args.output)

    mode = "full" if args.full else "sample"
    count = "all" if args.full else str(args.sample_size)
    _safe_print(f"Verify ({mode}): {count} tables vs PDF")
    report = run_spot_check(
        hsp_parsed_path=hsp_path,
        checkpoint_dir=ckpt_dir,
        pdf_path=pdf_path,
        output_path=output_path,
        sample_size=args.sample_size,
        seed=args.seed,
        full=args.full,
        include_passes=args.include_passes,
        progress_every=args.progress_every,
        checkpoint_every=args.checkpoint_every,
        resume=not args.no_resume,
        progress_path=Path(args.progress_file) if args.progress_file else None,
        log_fn=_safe_print,
    )
    s = report["summary"]
    _safe_print(f"Results: {s['pass']} pass, {s['partial']} partial, {s['fail']} fail")
    if s.get("progress_file"):
        _safe_print(f"Progress: {s['progress_file']}")
    for item in report["items"]:
        if item["verdict"] != "pass":
            _safe_print(f"  table {item['table_index']+1} p.{item['page_estimate']}: {item['verdict']}")
    _safe_print(f"Report: {output_path}")
    return 2 if args.strict and s["fail"] > 0 else 0


def cmd_link_kode(args: argparse.Namespace) -> int:
    if args.formular:
        from ahs_id.formular_link import run_formular_link

        summary = run_formular_link(
            pdf_path=Path(args.pdf),
            hsp_parsed_path=Path(args.hsp_parsed),
            checkpoint_dir=Path(args.checkpoints),
            output_path=Path(args.output),
            page_start=args.page_start,
            page_end=args.page_end,
        )
        _safe_print(f"Mode: formular boundary")
        _safe_print(f"Pages indexed: {summary['pages_indexed']}")
        _safe_print(f"Formular blocks: {summary['formular_blocks']}")
        _safe_print(
            f"HSP linked: {summary['linked_eligible']}/{summary['linkable_hsp']} eligible "
            f"({summary['link_rate_eligible_pct']}%)"
        )
        _safe_print(
            f"  (total classified HSP: {summary['linked']}/{summary['hsp_tables']} = "
            f"{summary['link_rate_pct']}%)"
        )
        _safe_print(f"High confidence: {summary['high_confidence_links']}")
        _safe_print(f"Blocks: {summary['formular_blocks_path']}")
        _safe_print(f"Output: {summary['output']}")
        return 0

    if args.ck_inline:
        summary = run_kode_link(
            pdf_path=Path(args.pdf),
            item_index_path=Path(args.item_index),
            hsp_parsed_path=Path(args.hsp_parsed),
            checkpoint_dir=Path(args.checkpoints),
            output_path=Path(args.output),
            page_start=args.page_start,
            page_end=args.page_end,
            ck_inline=True,
        )
        _safe_print("Mode: cipta-karya inline")
        _safe_print(f"PDF anchors: {summary['pdf_anchors_found']}")
        _safe_print(f"HSP linked: {summary['linked']}/{summary['hsp_tables']} ({summary['link_rate_pct']}%)")
        _safe_print(f"Page+L01 matches: {summary['page_l01_matches']}, mismatches: {summary['sequential_mismatch_warnings']}")
        _safe_print(f"Map: {summary['kode_table_map']}")
        return 0

    summary = run_kode_link(
        pdf_path=Path(args.pdf),
        item_index_path=Path(args.item_index),
        hsp_parsed_path=Path(args.hsp_parsed),
        checkpoint_dir=Path(args.checkpoints),
        output_path=Path(args.output),
        page_start=args.page_start,
        page_end=args.page_end,
    )
    _safe_print(f"PDF anchors: {summary['pdf_anchors_found']}")
    _safe_print(f"HSP linked: {summary['linked']}/{summary['hsp_tables']} ({summary['link_rate_pct']}%)")
    _safe_print(f"Page+L01 matches: {summary['page_l01_matches']}, mismatches: {summary['sequential_mismatch_warnings']}")
    _safe_print(f"Map: {summary['kode_table_map']}")
    return 0


def cmd_list_coefficients(args: argparse.Namespace) -> int:
    root = Path(args.root) if args.root else repo_root()
    coefficients = collect_package_coefficients(
        args.package,
        kode_filter=args.kode,
        root=root,
    )
    for c in coefficients:
        ref = c.ref or "-"
        name = c.name or ""
        print(f"{c.kode_ahsp}\t{c.component}\t{ref}\t{c.value}\t{name}")
    print(f"\nTotal: {len(coefficients)}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ahs-docling",
        description="Docling PDF extraction and Layer 1 verification for AHS-ID",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_extract = sub.add_parser("extract", help="Convert PDF to markdown + table CSV/JSON")
    p_extract.add_argument("source", help="Path or URL to PDF/document")
    p_extract.add_argument(
        "-o",
        "--output",
        default="tools/docling/output",
        help="Output directory (default: tools/docling/output)",
    )
    p_extract.add_argument(
        "--ocr",
        action="store_true",
        help="Enable OCR for scanned PDFs (default: off, use text layer)",
    )
    p_extract.add_argument(
        "--page-range",
        metavar="START-END",
        help="Only convert these pages, e.g. 1-50 or 120",
    )
    p_extract.add_argument(
        "--chunk-size",
        type=int,
        metavar="N",
        help="Pages per batch (default: auto — 20 if >500 pg, 15 if >200, else 10)",
    )
    p_extract.add_argument(
        "--no-progress",
        action="store_true",
        help="Disable progress bar and progress.json",
    )
    p_extract.add_argument(
        "--no-resume",
        action="store_true",
        help="Ignore existing checkpoints and reconvert every batch",
    )
    p_extract.set_defaults(func=cmd_extract)

    p_assign = sub.add_parser(
        "assign-page-estimates",
        help="Fast per-table page_no inside each checkpoint batch (no Docling re-run)",
    )
    p_assign.add_argument(
        "--checkpoints",
        required=True,
        help="Checkpoint directory (e.g. output/.../checkpoints)",
    )
    p_assign.set_defaults(func=cmd_assign_page_estimates)

    p_enrich = sub.add_parser(
        "enrich-pages",
        help="Add per-table page_no to existing extract checkpoints (for spot-check / formular link)",
    )
    p_enrich.add_argument("pdf", help="Source PDF used for extract")
    p_enrich.add_argument(
        "--checkpoints",
        required=True,
        help="Checkpoint directory (e.g. output/.../checkpoints)",
    )
    p_enrich.add_argument("--chunk-size", type=int, metavar="N", help="Pages per batch (reassemble)")
    p_enrich.add_argument("--ocr", action="store_true", help="Enable OCR when re-scanning batches")
    p_enrich.add_argument(
        "--force",
        action="store_true",
        help="Re-scan batches even if page_no already present",
    )
    p_enrich.add_argument(
        "--reassemble",
        action="store_true",
        help="After enrich, rebuild *-tables.json from checkpoints",
    )
    p_enrich.add_argument("--no-progress", action="store_true", help="Disable progress bar on reassemble")
    p_enrich.set_defaults(func=cmd_enrich_pages)

    p_verify = sub.add_parser("verify", help="Layer 1: compare bundle coefficients vs PDF text")
    p_verify.add_argument("--package", required=True, help="Package name, e.g. pupr-2023")
    p_verify.add_argument("--pdf", help="PDF path or URL (converted via Docling)")
    p_verify.add_argument("--markdown", help="Use pre-extracted markdown instead of PDF")
    p_verify.add_argument("--kode", help="Filter to one kode_ahsp, e.g. 3.2.1")
    p_verify.add_argument("--save-markdown", help="Save converted markdown to this path")
    p_verify.add_argument("--json-report", help="Write JSON verification report")
    p_verify.add_argument(
        "--ocr",
        action="store_true",
        help="Enable OCR when converting --pdf (scanned documents)",
    )
    p_verify.add_argument("--page-range", metavar="START-END", help="Limit PDF pages to convert")
    p_verify.add_argument("--chunk-size", type=int, metavar="N", help="Pages per progress batch")
    p_verify.add_argument("--no-progress", action="store_true", help="Disable progress bar")
    p_verify.add_argument("--no-resume", action="store_true", help="Ignore existing checkpoints")
    p_verify.add_argument(
        "--strict",
        action="store_true",
        help="Exit 2 if not_found, 3 if ambiguous",
    )
    p_verify.add_argument("--root", help="Monorepo root (auto-detected by default)")
    p_verify.set_defaults(func=cmd_verify)

    p_analyze = sub.add_parser("analyze", help="Clean, classify, and verify extracted tables")
    p_analyze.add_argument(
        "tables",
        help="Path to *-tables.json from extract",
    )
    p_analyze.add_argument(
        "-o",
        "--output",
        default="tools/docling/output/cleaned",
        help="Output directory for cleaned artifacts",
    )
    p_analyze.add_argument(
        "--no-by-type",
        action="store_true",
        help="Skip writing per-category CSV folders",
    )
    p_analyze.add_argument(
        "--strict",
        action="store_true",
        help="Exit 2 if any HSP verification errors",
    )
    p_analyze.set_defaults(func=cmd_analyze)

    p_spot = sub.add_parser("spot-check", help="Verify HSP tables against PDF text (sample or --full)")
    p_spot.add_argument(
        "--hsp-parsed",
        default="tools/docling/output/sda-se-47-2026/cleaned/hsp-parsed.jsonl",
        help="Path to hsp-parsed.jsonl",
    )
    p_spot.add_argument(
        "--checkpoints",
        default="tools/docling/output/sda-se-47-2026/checkpoints",
        help="Checkpoint dir for table→page mapping",
    )
    p_spot.add_argument(
        "--pdf",
        required=True,
        help="Source PDF path",
    )
    p_spot.add_argument(
        "-o",
        "--output",
        default="tools/docling/output/sda-se-47-2026/cleaned/spot-check-report.json",
        help="JSON report output path",
    )
    p_spot.add_argument("--sample-size", type=int, default=25)
    p_spot.add_argument("--seed", type=int, default=42)
    p_spot.add_argument(
        "--full",
        action="store_true",
        help="Verify every eligible HSP table (not a random sample)",
    )
    p_spot.add_argument(
        "--include-passes",
        action="store_true",
        help="With --full: write all items to report (default: failures/partials only)",
    )
    p_spot.add_argument(
        "--progress-every",
        type=int,
        default=100,
        help="Log progress every N tables in --full mode (0=off)",
    )
    p_spot.add_argument(
        "--checkpoint-every",
        type=int,
        default=25,
        help="With --full: save resumable progress every N tables (default 25)",
    )
    p_spot.add_argument(
        "--no-resume",
        action="store_true",
        help="With --full: ignore existing full-check-progress.json and start over",
    )
    p_spot.add_argument(
        "--progress-file",
        help="With --full: custom progress JSON path (default: cleaned/full-check-progress.json)",
    )
    p_spot.add_argument("--strict", action="store_true", help="Exit 2 if any fail")
    p_spot.set_defaults(func=cmd_spot_check)

    p_link = sub.add_parser("link-kode", help="Link kode_ahsp to HSP tables via PDF headers")
    p_link.add_argument("--pdf", required=True, help="Source PDF path")
    p_link.add_argument(
        "--item-index",
        default="tools/docling/output/sda-se-47-2026/cleaned/item-index.csv",
    )
    p_link.add_argument(
        "--hsp-parsed",
        default="tools/docling/output/sda-se-47-2026/cleaned/hsp-parsed.jsonl",
    )
    p_link.add_argument(
        "--checkpoints",
        default="tools/docling/output/sda-se-47-2026/checkpoints",
    )
    p_link.add_argument(
        "-o",
        "--output",
        default="tools/docling/output/sda-se-47-2026/cleaned/hsp-linked.jsonl",
    )
    p_link.add_argument("--page-start", type=int, default=1)
    p_link.add_argument("--page-end", type=int, default=None)
    p_link.add_argument(
        "--formular",
        action="store_true",
        help="Bina Marga: link via multi-page formular boundaries (ASUMSI→HSP)",
    )
    p_link.add_argument(
        "--ck-inline",
        action="store_true",
        help="Cipta Karya: link via inline item kode + HSP on same page",
    )
    p_link.set_defaults(func=cmd_link_kode)

    p_list = sub.add_parser("list-coefficients", help="List static coefficients from a bundle")
    p_list.add_argument("--package", required=True)
    p_list.add_argument("--kode", help="Filter to one kode_ahsp")
    p_list.add_argument("--root", help="Monorepo root")
    p_list.set_defaults(func=cmd_list_coefficients)

    return parser


def main(argv: list[str] | None = None) -> int:
    _configure_stdio()
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
