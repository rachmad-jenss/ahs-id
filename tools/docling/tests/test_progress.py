"""Tests for progress helpers."""

import pytest

from ahs_id.progress import iter_page_chunks, parse_page_range


def test_parse_page_range_full():
    assert parse_page_range(None, 100) == (1, 100)


def test_parse_page_range_slice():
    assert parse_page_range("10-20", 100) == (10, 20)


def test_parse_page_range_clamps_end():
    assert parse_page_range("90-200", 100) == (90, 100)


def test_iter_page_chunks():
    assert iter_page_chunks(1, 10, 4) == [(1, 4), (5, 8), (9, 10)]


def test_parse_invalid_range():
    with pytest.raises(ValueError):
        parse_page_range("5-2", 100)
