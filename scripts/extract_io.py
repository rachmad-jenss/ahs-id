"""Shared workbook arguments for the tracked AHSP extractors."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def parse_workbook_args(suffixes: set[str], default_output: Path, *, hsd_output: Path | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Source workbook")
    parser.add_argument("--output", default=str(default_output), help="Output file or directory")
    if hsd_output is not None:
        parser.add_argument("--hsd-output", default=str(hsd_output), help="HSD JSON updated by this extractor")
    args = parser.parse_args()
    source = Path(args.input)
    if source.suffix.lower() not in suffixes:
        allowed = ", ".join(sorted(suffixes))
        print(f"--input must end with {allowed}", file=sys.stderr)
        raise SystemExit(2)
    if not source.is_file():
        print(f"input not found: {args.input}", file=sys.stderr)
        raise SystemExit(2)
    return args


def display_path(path: Path) -> str:
    root = Path(__file__).resolve().parent.parent
    try:
        return str(path.resolve().relative_to(root))
    except ValueError:
        return str(path)
