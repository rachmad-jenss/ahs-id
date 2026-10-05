"""Load AHSP items from AHS-ID package JSON bundles."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator


@dataclass(frozen=True)
class CoefficientRef:
    """A single coefficient value traceable to an AHSP item."""

    kode_ahsp: str
    component: str  # tenaga_kerja | bahan | peralatan
    ref: str | None
    name: str | None
    value: float
    koef_sumber: str | None


def repo_root() -> Path:
    """Resolve monorepo root from tools/docling/."""
    return Path(__file__).resolve().parents[3]


def iter_ahsp_json_files(package_dir: Path) -> Iterator[Path]:
    ahsp_root = package_dir / "data" / "ahsp"
    if not ahsp_root.is_dir():
        return
    yield from sorted(ahsp_root.rglob("*.json"))


def load_items_from_file(path: Path) -> list[dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict) and "kode_ahsp" in item]
    if isinstance(raw, dict) and "kode_ahsp" in raw:
        return [raw]
    return []


def load_package_items(package_name: str, root: Path | None = None) -> list[dict[str, Any]]:
    base = (root or repo_root()) / "packages" / package_name
    if not base.is_dir():
        raise FileNotFoundError(f"Package not found: {base}")

    items: list[dict[str, Any]] = []
    for path in iter_ahsp_json_files(base):
        items.extend(load_items_from_file(path))
    return items


def collect_coefficients(item: dict[str, Any]) -> list[CoefficientRef]:
    """Flatten static coefficients from one AhspItem."""
    kode = str(item["kode_ahsp"])
    out: list[CoefficientRef] = []

    for tk in item.get("tenaga_kerja") or []:
        if tk.get("koef_sumber") != "tabel":
            continue
        out.append(
            CoefficientRef(
                kode_ahsp=kode,
                component="tenaga_kerja",
                ref=tk.get("ref"),
                name=tk.get("nama"),
                value=float(tk["koefisien"]),
                koef_sumber=tk.get("koef_sumber"),
            )
        )

    for bahan in item.get("bahan") or []:
        if bahan.get("koef_sumber") != "tabel":
            continue
        out.append(
            CoefficientRef(
                kode_ahsp=kode,
                component="bahan",
                ref=bahan.get("ref"),
                name=bahan.get("nama") or bahan.get("nama_override"),
                value=float(bahan["koefisien"]),
                koef_sumber=bahan.get("koef_sumber"),
            )
        )

    for alat in item.get("peralatan") or []:
        if alat.get("koef_sumber") != "tabel":
            ref_obj = alat.get("koef_referensi")
            if isinstance(ref_obj, dict) and ref_obj.get("value") is not None:
                out.append(
                    CoefficientRef(
                        kode_ahsp=kode,
                        component="peralatan",
                        ref=alat.get("ref"),
                        name=alat.get("nama"),
                        value=float(ref_obj["value"]),
                        koef_sumber=alat.get("koef_sumber"),
                    )
                )
            continue
        koef = alat.get("koefisien")
        if koef is None:
            continue
        out.append(
            CoefficientRef(
                kode_ahsp=kode,
                component="peralatan",
                ref=alat.get("ref"),
                name=alat.get("nama"),
                value=float(koef),
                koef_sumber=alat.get("koef_sumber"),
            )
        )

    return out


def collect_package_coefficients(
    package_name: str,
    *,
    kode_filter: str | None = None,
    root: Path | None = None,
) -> list[CoefficientRef]:
    refs: list[CoefficientRef] = []
    for item in load_package_items(package_name, root):
        if kode_filter and item.get("kode_ahsp") != kode_filter:
            continue
        refs.extend(collect_coefficients(item))
    return refs
