"""Tests for checkpoint assembly and resume logic (no Docling required)."""

import json

from ahs_id.docling_convert import (
    _assemble_from_checkpoints,
    _checkpoint_path,
    _write_checkpoint_atomic,
)


def test_write_and_assemble_checkpoints(tmp_path):
    chunks = [(1, 3), (4, 6)]

    _write_checkpoint_atomic(
        _checkpoint_path(tmp_path, 1, 3),
        {
            "page_start": 1,
            "page_end": 3,
            "markdown": "PAGE 1-3",
            "tables": [{"index": 0, "rows": 1, "cols": 1, "columns": ["a"], "records": [{"a": "1"}]}],
        },
    )
    _write_checkpoint_atomic(
        _checkpoint_path(tmp_path, 4, 6),
        {
            "page_start": 4,
            "page_end": 6,
            "markdown": "PAGE 4-6",
            "tables": [
                {"index": 0, "rows": 1, "cols": 1, "columns": ["b"], "records": [{"b": "2"}]},
                {"index": 1, "rows": 1, "cols": 1, "columns": ["c"], "records": [{"c": "3"}]},
            ],
        },
    )

    markdown, tables = _assemble_from_checkpoints(tmp_path, chunks, multi=True)

    assert "PAGE 1-3" in markdown
    assert "PAGE 4-6" in markdown
    assert markdown.index("PAGE 1-3") < markdown.index("PAGE 4-6")

    # Tables re-indexed globally across batches
    assert [t["index"] for t in tables] == [0, 1, 2]


def test_assemble_skips_missing_checkpoint(tmp_path):
    chunks = [(1, 3), (4, 6)]
    _write_checkpoint_atomic(
        _checkpoint_path(tmp_path, 1, 3),
        {"page_start": 1, "page_end": 3, "markdown": "ONLY FIRST", "tables": []},
    )

    markdown, tables = _assemble_from_checkpoints(tmp_path, chunks, multi=True)

    assert "ONLY FIRST" in markdown
    assert tables == []


def test_checkpoint_written_atomically(tmp_path):
    path = _checkpoint_path(tmp_path, 10, 20)
    _write_checkpoint_atomic(path, {"page_start": 10, "page_end": 20, "markdown": "x", "tables": []})
    assert path.exists()
    assert not path.with_suffix(".json.tmp").exists()
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["page_start"] == 10
