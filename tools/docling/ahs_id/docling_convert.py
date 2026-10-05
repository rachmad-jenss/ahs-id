"""Docling document conversion helpers."""

from __future__ import annotations

import json
import os
import sys
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, TextIO

import pandas as pd

from ahs_id.progress import ProgressTracker, iter_page_chunks, parse_page_range


class _SafeTextIO:
    """Wrap stderr so third-party tqdm cannot crash extract on broken pipes."""

    def __init__(self, stream: TextIO) -> None:
        self._stream = stream

    def write(self, data: str) -> int:
        try:
            return self._stream.write(data)
        except OSError:
            return len(data)

    def flush(self) -> None:
        try:
            self._stream.flush()
        except OSError:
            pass

    def __getattr__(self, name: str) -> Any:
        return getattr(self._stream, name)


def prepare_long_extract_env() -> None:
    """Disable nested progress bars that raise OSError 22 on Windows when pipes break."""
    os.environ.setdefault("TQDM_DISABLE", "1")
    os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
    os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")


@contextmanager
def _safe_stderr():
    prepare_long_extract_env()
    wrapped = _SafeTextIO(sys.stderr)
    previous = sys.stderr
    sys.stderr = wrapped
    try:
        yield
    finally:
        sys.stderr = previous


@dataclass
class ConversionResult:
    """Artifacts produced from a Docling conversion."""

    source: Path
    markdown: str
    tables: list[dict[str, Any]] = field(default_factory=list)
    page_count: int | None = None
    page_range: tuple[int, int] | None = None


def count_pdf_pages(source: str | Path) -> int | None:
    """Fast page count via pypdfium2 (bundled with Docling)."""
    if str(source).startswith(("http://", "https://")):
        return None
    path = Path(source)
    if path.suffix.lower() != ".pdf":
        return None
    try:
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(str(path))
        return len(pdf)
    except Exception:
        return None


def build_converter(*, enable_ocr: bool = False, do_table_structure: bool = True):
    """
    Build a DocumentConverter tuned for regulation PDFs.

    Digital PDFs from JDIH typically have an embedded text layer — OCR is
    disabled by default to avoid RapidOCR/torch issues and speed up conversion.
    Pass enable_ocr=True for scanned documents.
    """
    from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    pipeline_options = PdfPipelineOptions(
        do_ocr=enable_ocr,
        do_table_structure=do_table_structure,
    )

    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=pipeline_options,
                backend=PyPdfiumDocumentBackend,
            ),
        },
    )


def _has_tabulate() -> bool:
    try:
        import tabulate  # noqa: F401

        return True
    except ImportError:
        return False


def _dedupe_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    seen: dict[str, int] = {}
    unique_cols: list[str] = []
    for col in df.columns:
        key = str(col)
        count = seen.get(key, 0)
        seen[key] = count + 1
        unique_cols.append(f"{key}_{count}" if count else key)
    df = df.copy()
    df.columns = unique_cols
    return df


def _extract_tables_from_doc(doc: Any, *, index_offset: int = 0) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    for index, table in enumerate(doc.tables):
        df: pd.DataFrame = table.export_to_dataframe(doc=doc)
        df = _dedupe_dataframe_columns(df)
        global_index = index_offset + index
        tables.append(
            {
                "index": global_index,
                "rows": int(len(df)),
                "cols": int(len(df.columns)),
                "columns": [str(c) for c in df.columns],
                "records": df.fillna("").astype(str).to_dict(orient="records"),
                "markdown": df.to_markdown(index=False) if _has_tabulate() else None,
            }
        )
    return tables


def _resolve_page_count(doc: Any, conv: Any) -> int | None:
    num_pages = getattr(doc, "num_pages", None)
    if callable(num_pages):
        return int(num_pages())
    if isinstance(num_pages, int):
        return num_pages
    if hasattr(conv, "pages"):
        return len(conv.pages)  # type: ignore[attr-defined]
    return None


def _default_chunk_size(total_pages: int) -> int:
    if total_pages <= 50:
        return total_pages
    if total_pages <= 200:
        return 10
    if total_pages <= 500:
        return 15
    return 20


def _checkpoint_path(checkpoint_dir: Path, p_start: int, p_end: int) -> Path:
    return checkpoint_dir / f"batch-{p_start:06d}-{p_end:06d}.json"


def _write_checkpoint_atomic(path: Path, payload: dict[str, Any]) -> None:
    """Write a batch checkpoint atomically (tmp file + rename) so a kill mid-write
    never corrupts a completed batch."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def _load_checkpoint(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def convert_document(
    source: str | Path,
    *,
    enable_ocr: bool = False,
    page_range_spec: str | None = None,
    chunk_size: int | None = None,
    show_progress: bool = True,
    status_path: Path | None = None,
    do_table_structure: bool = True,
    checkpoint_dir: Path | None = None,
    resume: bool = True,
) -> ConversionResult:
    """
    Convert a PDF (or other supported format) with Docling.

    Large PDFs are processed in page batches. When ``checkpoint_dir`` is set,
    each batch is flushed to disk immediately, so stopping or crashing loses at
    most the batch in flight — and a later run with ``resume=True`` skips every
    batch already on disk.

    Raises ImportError if docling is not installed.
    """
    src = Path(source) if not str(source).startswith(("http://", "https://")) else source
    resolved = (
        Path(str(source))
        if isinstance(source, (str, Path)) and not str(source).startswith("http")
        else Path("remote.pdf")
    )

    total_pages = count_pdf_pages(src)
    range_start, range_end = (
        parse_page_range(page_range_spec, total_pages) if total_pages else (1, 1)
    )

    effective_chunk = chunk_size or (_default_chunk_size(range_end - range_start + 1) if total_pages else 1)
    chunks = (
        iter_page_chunks(range_start, range_end, effective_chunk)
        if total_pages and (range_end - range_start + 1) > effective_chunk
        else [(range_start, range_end)] if total_pages else [(1, 1)]
    )

    converter = None  # lazily built so a fully-resumed run needs no model load
    pages_in_job = (range_end - range_start + 1) if total_pages else 0

    tracker = ProgressTracker(
        total_pages=pages_in_job or 1,
        status_path=status_path,
        enabled=show_progress,
    )
    tracker.start(chunk_total=len(chunks))

    try:
        with _safe_stderr():
            for chunk_idx, (p_start, p_end) in enumerate(chunks, start=1):
                tracker.begin_chunk(chunk_idx, p_start, p_end)

                ckpt = _checkpoint_path(checkpoint_dir, p_start, p_end) if checkpoint_dir else None
                if resume and ckpt is not None and ckpt.exists():
                    cached = _load_checkpoint(ckpt)
                    if cached is not None:
                        tracker.end_chunk(p_start, p_end, len(cached.get("tables", [])), resumed=True)
                        continue

                if converter is None:
                    converter = build_converter(
                        enable_ocr=enable_ocr, do_table_structure=do_table_structure
                    )

                if total_pages and len(chunks) > 1:
                    conv = converter.convert(src, page_range=(p_start, p_end))
                else:
                    kwargs: dict[str, Any] = {}
                    if total_pages and page_range_spec:
                        kwargs["page_range"] = (p_start, p_end)
                    conv = converter.convert(src, **kwargs)

                doc = conv.document
                chunk_md = doc.export_to_markdown()
                chunk_tables = _extract_tables_from_doc(doc)

                if ckpt is not None:
                    _write_checkpoint_atomic(
                        ckpt,
                        {
                            "page_start": p_start,
                            "page_end": p_end,
                            "markdown": chunk_md,
                            "tables": chunk_tables,
                        },
                    )

                tracker.end_chunk(p_start, p_end, len(chunk_tables))

        tracker.finish()
    except Exception as exc:
        tracker.fail(str(exc))
        raise

    if checkpoint_dir is not None:
        markdown, all_tables = _assemble_from_checkpoints(checkpoint_dir, chunks, multi=len(chunks) > 1)
    else:
        # single-shot path kept for non-checkpoint callers
        raise RuntimeError("convert_document requires checkpoint_dir for assembly")

    page_count = pages_in_job if total_pages else None

    return ConversionResult(
        source=resolved,
        markdown=markdown,
        tables=all_tables,
        page_count=page_count,
        page_range=(range_start, range_end) if total_pages else None,
    )


def _assemble_from_checkpoints(
    checkpoint_dir: Path,
    chunks: list[tuple[int, int]],
    *,
    multi: bool,
) -> tuple[str, list[dict[str, Any]]]:
    """Concatenate all batch checkpoints in page order and re-index tables globally."""
    markdown_parts: list[str] = []
    all_tables: list[dict[str, Any]] = []
    table_offset = 0

    for p_start, p_end in chunks:
        ckpt = _checkpoint_path(checkpoint_dir, p_start, p_end)
        data = _load_checkpoint(ckpt)
        if data is None:
            continue

        chunk_md = data.get("markdown", "")
        if multi:
            markdown_parts.append(f"\n\n<!-- pages {p_start}-{p_end} -->\n\n{chunk_md}")
        else:
            markdown_parts.append(chunk_md)

        for tbl in data.get("tables", []):
            tbl = dict(tbl)
            tbl["index"] = table_offset
            table_offset += 1
            all_tables.append(tbl)

    return "".join(markdown_parts), all_tables


def write_conversion_artifacts(result: ConversionResult, output_dir: Path) -> dict[str, Path]:
    """Persist markdown, tables JSON, and per-table CSV files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = result.source.stem

    md_path = output_dir / f"{stem}.md"
    md_path.write_text(result.markdown, encoding="utf-8")

    tables_path = output_dir / f"{stem}-tables.json"
    tables_path.write_text(
        json.dumps(result.tables, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    written: dict[str, Path] = {"markdown": md_path, "tables_json": tables_path}

    for table in result.tables:
        idx = table["index"]
        csv_path = output_dir / f"{stem}-table-{idx + 1}.csv"
        records = table["records"]
        if records:
            pd.DataFrame(records).to_csv(csv_path, index=False, encoding="utf-8")
            written[f"table_{idx + 1}_csv"] = csv_path

    return written
