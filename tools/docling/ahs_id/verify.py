"""Layer 1 verification — compare bundle coefficients against Docling PDF text."""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

from ahs_id.bundle import CoefficientRef


class MatchStatus(str, Enum):
    FOUND = "found"
    NOT_FOUND = "not_found"
    AMBIGUOUS = "ambiguous"


@dataclass(frozen=True)
class VerificationRow:
    coefficient: CoefficientRef
    status: MatchStatus
    detail: str


def _float_variants(value: float) -> list[str]:
    """Common string forms for a coefficient in regulation PDFs."""
    variants: set[str] = set()
    variants.add(f"{value:g}")
    variants.add(f"{value:.3f}".rstrip("0").rstrip("."))
    variants.add(f"{value:.4f}".rstrip("0").rstrip("."))
    if value < 1:
        # Indonesian decimal comma style
        variants.add(f"{value:.3f}".replace(".", ",").rstrip("0").rstrip(","))
    return sorted(variants, key=len, reverse=True)


def _window_around(haystack: str, needle: str, radius: int = 400) -> list[str]:
    windows: list[str] = []
    start = 0
    while True:
        pos = haystack.find(needle, start)
        if pos < 0:
            break
        lo = max(0, pos - radius)
        hi = min(len(haystack), pos + len(needle) + radius)
        windows.append(haystack[lo:hi])
        start = pos + len(needle)
    return windows


def verify_coefficient_in_text(coef: CoefficientRef, text: str) -> VerificationRow:
    """
    Heuristic Layer 1 check: value must appear in text near kode_ahsp or component ref.

    Dynamic/kalkulasi refs are checked with relaxed rules (value anywhere after kode).
    """
    normalized = text.replace("\u00a0", " ")
    kode = coef.kode_ahsp
    value_patterns = _float_variants(coef.value)

    if kode not in normalized:
        return VerificationRow(
            coefficient=coef,
            status=MatchStatus.NOT_FOUND,
            detail=f"kode_ahsp {kode} not present in document text",
        )

    kode_windows = _window_around(normalized, kode, radius=1200)
    if not kode_windows:
        kode_windows = [normalized]

    ref_token = None
    if coef.ref:
        ref_token = coef.ref.replace(".", "")
        ref_token_alt = coef.ref

    for window in kode_windows:
        for pattern in value_patterns:
            if pattern not in window:
                continue

            if ref_token and (ref_token in window or (ref_token_alt and ref_token_alt in window)):
                return VerificationRow(
                    coefficient=coef,
                    status=MatchStatus.FOUND,
                    detail=f"value {pattern} near {kode} and ref {coef.ref}",
                )

            if coef.koef_sumber == "kalkulasi":
                return VerificationRow(
                    coefficient=coef,
                    status=MatchStatus.FOUND,
                    detail=f"reference value {pattern} near {kode} (kalkulasi)",
                )

            # Value near kode without ref — ambiguous but useful for spot-check
            occurrences = len(re.findall(re.escape(pattern), window))
            if occurrences == 1:
                return VerificationRow(
                    coefficient=coef,
                    status=MatchStatus.FOUND,
                    detail=f"value {pattern} uniquely near {kode}",
                )
            return VerificationRow(
                coefficient=coef,
                status=MatchStatus.AMBIGUOUS,
                detail=f"value {pattern} appears {occurrences}× near {kode} without ref match",
            )

    return VerificationRow(
        coefficient=coef,
        status=MatchStatus.NOT_FOUND,
        detail=f"values {value_patterns} not found near {kode}",
    )


def verify_coefficients_in_text(
    coefficients: list[CoefficientRef],
    text: str,
) -> list[VerificationRow]:
    return [verify_coefficient_in_text(c, text) for c in coefficients]


def summarize(rows: list[VerificationRow]) -> dict[str, int]:
    counts = {s.value: 0 for s in MatchStatus}
    for row in rows:
        counts[row.status.value] += 1
    return counts
