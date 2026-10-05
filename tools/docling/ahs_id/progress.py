"""Progress reporting for long Docling conversions."""

from __future__ import annotations

import json
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ProgressState:
    total_pages: int
    completed_pages: int = 0
    current_range: str | None = None
    chunk_index: int = 0
    chunk_total: int = 0
    tables_found: int = 0
    elapsed_s: float = 0.0
    status: str = "starting"

    def to_dict(self) -> dict:
        pct = round(100 * self.completed_pages / self.total_pages, 1) if self.total_pages else 0
        in_batch = self.status.startswith("processing")
        return {
            "total_pages": self.total_pages,
            "completed_pages": self.completed_pages,
            "percent": pct,
            "current_range": self.current_range,
            "chunk": f"{self.chunk_index}/{self.chunk_total}",
            "tables_found": self.tables_found,
            "elapsed_s": round(self.elapsed_s, 1),
            "status": self.status,
            "note": (
                "counters update when each batch finishes; elapsed_s ticks every 5s during batch"
                if in_batch
                else None
            ),
        }


def _use_tqdm() -> bool:
    """Line progress + progress.json only — tqdm breaks on long Cursor background runs."""
    return False


@dataclass
class ProgressTracker:
    """Console + optional JSON file progress for chunked PDF conversion."""

    total_pages: int
    status_path: Path | None = None
    enabled: bool = True
    state: ProgressState = field(init=False)
    _started: float = field(init=False, default=0.0)
    _tqdm: object | None = field(init=False, default=None)
    _heartbeat_stop: threading.Event | None = field(init=False, default=None)
    _heartbeat_thread: threading.Thread | None = field(init=False, default=None)

    def __post_init__(self) -> None:
        self.state = ProgressState(total_pages=self.total_pages)
        self._started = time.monotonic()

    def start(self, chunk_total: int) -> None:
        self.state.chunk_total = chunk_total
        self.state.status = "converting"
        self._touch_elapsed()
        self._flush()

        if not self.enabled:
            return

        if _use_tqdm():
            try:
                from tqdm import tqdm

                self._tqdm = tqdm(
                    total=self.total_pages,
                    unit="pg",
                    desc="Docling",
                    dynamic_ncols=True,
                    file=sys.stderr,
                )
                return
            except ImportError:
                pass

        self._log(
            f"Docling: {self.total_pages} pages, {chunk_total} batch(es) "
            f"(line progress — watch progress.json if terminal is static)"
        )

    def begin_chunk(self, chunk_index: int, page_start: int, page_end: int) -> None:
        self.state.chunk_index = chunk_index
        self.state.current_range = f"{page_start}-{page_end}"
        self.state.status = f"processing batch {chunk_index}/{self.state.chunk_total}"
        self._touch_elapsed()
        self._flush()
        self._start_heartbeat()

        if self._tqdm is None and self.enabled:
            self._log(
                f"▶ batch {chunk_index}/{self.state.chunk_total}: "
                f"pages {page_start}–{page_end} ..."
            )

    def end_chunk(
        self, page_start: int, page_end: int, tables_in_chunk: int, *, resumed: bool = False
    ) -> None:
        self._stop_heartbeat()

        pages_done = page_end - page_start + 1
        self.state.completed_pages = min(self.total_pages, self.state.completed_pages + pages_done)
        self.state.tables_found += tables_in_chunk
        mark = "⏭ resumed" if resumed else "✓"
        self.state.status = f"done batch {self.state.chunk_index}/{self.state.chunk_total}"
        self._touch_elapsed()
        self._flush()

        if self._tqdm is not None:
            try:
                self._tqdm.update(pages_done)
                self._tqdm.set_postfix(tables=self.state.tables_found, refresh=True)
            except OSError:
                self._tqdm = None
        elif self.enabled:
            pct = self.state.to_dict()["percent"]
            self._log(
                f"{mark} batch {self.state.chunk_index}/{self.state.chunk_total}: "
                f"pages {page_start}–{page_end} | {pct}% | "
                f"{self.state.tables_found} tables | {self.state.elapsed_s:.0f}s"
            )

    def finish(self) -> None:
        self._stop_heartbeat()
        self.state.status = "done"
        self.state.completed_pages = self.total_pages
        self._touch_elapsed()
        self._flush()

        if self._tqdm is not None:
            self._tqdm.set_postfix(tables=self.state.tables_found, refresh=True)
            self._tqdm.close()
            self._tqdm = None
        elif self.enabled:
            self._log(
                f"Done: {self.total_pages} pages, {self.state.tables_found} tables, "
                f"{self.state.elapsed_s:.0f}s"
            )

    def fail(self, message: str) -> None:
        self._stop_heartbeat()
        self.state.status = f"failed: {message}"
        self._touch_elapsed()
        self._flush()
        if self._tqdm is not None:
            self._tqdm.close()
            self._tqdm = None
        elif self.enabled:
            self._log(f"FAILED: {message}")

    def _touch_elapsed(self) -> None:
        self.state.elapsed_s = time.monotonic() - self._started

    def _log(self, message: str) -> None:
        try:
            print(message, flush=True)
        except (OSError, UnicodeEncodeError):
            # Broken stdout pipe (Windows Errno 22) — progress.json still updates.
            pass

    def _start_heartbeat(self) -> None:
        if self.status_path is None:
            return
        self._stop_heartbeat()
        stop = threading.Event()
        self._heartbeat_stop = stop

        def loop() -> None:
            while not stop.wait(5):
                self._touch_elapsed()
                self._flush()

        self._heartbeat_thread = threading.Thread(target=loop, daemon=True)
        self._heartbeat_thread.start()

    def _stop_heartbeat(self) -> None:
        if self._heartbeat_stop is not None:
            self._heartbeat_stop.set()
        if self._heartbeat_thread is not None:
            self._heartbeat_thread.join(timeout=2)
        self._heartbeat_stop = None
        self._heartbeat_thread = None

    def _flush(self) -> None:
        if self.status_path is None:
            return
        self.status_path.parent.mkdir(parents=True, exist_ok=True)
        self.status_path.write_text(
            json.dumps(self.state.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


def parse_page_range(spec: str | None, total_pages: int) -> tuple[int, int]:
    """Parse '1-50' or '10' into inclusive (start, end) page numbers."""
    if not spec:
        return 1, total_pages

    spec = spec.strip()
    if "-" in spec:
        start_s, end_s = spec.split("-", 1)
        start, end = int(start_s), int(end_s)
    else:
        start = end = int(spec)

    if start < 1:
        raise ValueError("Page range start must be ≥ 1")
    if end < start:
        raise ValueError("Page range end must be ≥ start")
    if end > total_pages:
        end = total_pages
    return start, end


def iter_page_chunks(page_start: int, page_end: int, chunk_size: int) -> list[tuple[int, int]]:
    chunks: list[tuple[int, int]] = []
    current = page_start
    while current <= page_end:
        batch_end = min(current + chunk_size - 1, page_end)
        chunks.append((current, batch_end))
        current = batch_end + 1
    return chunks
