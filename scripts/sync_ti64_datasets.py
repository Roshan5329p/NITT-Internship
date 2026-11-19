#!/usr/bin/env python3
"""
Deterministic & Idempotent Ti-6Al-4V Relational Dataset Sync & Backfill Script.

Maps all 178 papers in data/ti64_papers.csv across the 4 child relational CSVs:
  - data/ti64_process_parameters.csv
  - data/ti64_thermal_physics.csv
  - data/ti64_microstructure.csv
  - data/ti64_mechanical_properties.csv

Rules:
  - Preserves all existing positional column indices (0..N-1) so existing Java/Node
    CSV loaders (ProcessWindowPlotter.java, AmPlatformApplication.java) continue working.
  - Appends standardized Ti-6Al-4V metallurgical columns at the tail of each schema:
      * process_parameters: scan_rotation_deg, powder_reuse_cycles, oxygen_wt_pct
      * thermal_physics:    defect_type, max_defect_size_um
      * microstructure:     alpha_lath_width_um, oxygen_wt_pct
      * mechanical_props:   build_orientation_deg, oxygen_wt_pct, max_defect_size_um,
                            defect_type, relative_density_pct
  - ZERO fabricated data: only ingests verified workspace records (existing CSVs,
    explicit CSV notes/strategies, verified PDF facts, and PAPERS_DATABASE P-59..P-78
    in process_windows_dashboard.html). Missing fields remain empty ("") and are
    logged transparently in data/backfill_coverage_report.json.
"""

from __future__ import annotations

import csv
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

PAPERS_CSV = DATA_DIR / "ti64_papers.csv"
SCOPUS_CSV = DATA_DIR / "scopus_100_multimodal_papers.csv"
DASHBOARD_HTML = ROOT / "process_windows_dashboard.html"

PROC_CSV = DATA_DIR / "ti64_process_parameters.csv"
THERM_CSV = DATA_DIR / "ti64_thermal_physics.csv"
MICRO_CSV = DATA_DIR / "ti64_microstructure.csv"
MECH_CSV = DATA_DIR / "ti64_mechanical_properties.csv"
REPORT_JSON = DATA_DIR / "backfill_coverage_report.json"

# Canonical schema definitions (existing columns preserved in exact positional order)
PROC_BASE_COLS = [
    "id", "paper_number", "laser_power_w", "scan_speed_mms", "layer_thickness_um",
    "hatch_spacing_um", "volumetric_energy_density_j_mm3", "beam_spot_diameter_um",
    "wire_feed_speed_m_min", "powder_feed_rate_g_min", "scan_strategy", "notes",
]
PROC_NEW_COLS = ["scan_rotation_deg", "powder_reuse_cycles", "oxygen_wt_pct"]

THERM_BASE_COLS = [
    "id", "paper_number", "melt_pool_width_um", "melt_pool_depth_um",
    "peak_temperature_k", "cooling_rate_k_s", "thermal_gradient_g_k_m",
    "solidification_rate_r_m_s", "residual_stress_mpa", "distortion_mm",
    "defect_regime", "notes",
]
THERM_NEW_COLS = ["defect_type", "max_defect_size_um"]

MICRO_BASE_COLS = [
    "id", "paper_number", "condition", "phases_identified", "alpha_fraction_pct",
    "beta_fraction_pct", "alpha_prime_fraction_pct", "alpha_lath_thickness_um",
    "prior_beta_grain_width_um", "prior_beta_morphology", "characterization_methods",
    "notes",
]
MICRO_NEW_COLS = ["alpha_lath_width_um", "oxygen_wt_pct"]

MECH_BASE_COLS = [
    "id", "paper_number", "test_direction", "condition", "yield_strength_mpa",
    "ultimate_tensile_strength_mpa", "elongation_pct", "vickers_hardness_hv",
    "fracture_toughness_kic_mpa_m05", "charpy_impact_energy_j", "fatigue_limit_mpa",
    "astm_f2924_compliant", "astm_f3001_compliant", "notes",
]
MECH_NEW_COLS = [
    "build_orientation_deg", "oxygen_wt_pct", "max_defect_size_um",
    "defect_type", "relative_density_pct",
]

# Verified explicit facts present in workspace CSV notes / local PDFs (never fabricated)
VERIFIED_PAPER_OXYGEN_REUSE: Dict[int, Dict[str, str]] = {
    # Paper #3 (Asherloo et al., 2022) - explicit in ti64_microstructure.csv notes:
    # "Higher interstitial oxygen (0.19 wt%) in HDH powder restricted ductility"
    3: {"oxygen_wt_pct": "0.19"},
    # Paper #10 (Denti et al., 2019) - explicit in ti64_process_parameters & microstructure notes:
    # "Interstitial oxygen increased from 0.13 wt% (Cycle 1) to 0.17 wt% (Cycle 10)"
    10: {"oxygen_wt_pct": "0.17", "powder_reuse_cycles": "10"},
    # Paper #23 (Koushik et al., 2023 PDF p.14-15) - explicit experimental endpoint:
    # "10 powder recycles... 0.107% in the virgin powder to 0.129% in the 10th recycled powder"
    23: {"oxygen_wt_pct": "0.129", "powder_reuse_cycles": "10"},
}


def canonical_process_bucket(raw_proc: str) -> str:
    low = (raw_proc or "").lower()
    if "binder" in low:
        return "binder_jetting"
    if "waam" in low:
        return "waam"
    if any(k in low for k in ["ded", "lmd", "lens", "wire-laser", "w-ded"]):
        return "lded"
    if any(k in low for k in ["lpbf", "slm", "pbf-lb"]):
        return "lpbf"
    return "ebm_other"


def process_priority_rank(bucket: str) -> int:
    # Prioritize missing WAAM, L-DED, and Binder Jetting entries first
    order = {
        "waam": 0,
        "lded": 1,
        "binder_jetting": 2,
        "lpbf": 3,
        "ebm_other": 4,
    }
    return order.get(bucket, 9)


def read_csv_rows(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def write_csv_rows(path: Path, fieldnames: List[str], rows: List[Dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            clean = {col: ("" if row.get(col) is None else str(row.get(col, ""))) for col in fieldnames}
            writer.writerow(clean)


def parse_scan_rotation_deg(scan_strategy: str) -> str:
    s = (scan_strategy or "").strip()
    if not s:
        return ""
    m = re.search(r"\b(67|90|45|0)\s*(?:°|deg\b)", s, re.IGNORECASE)
    if m:
        return m.group(1)
    return ""


def parse_build_orientation_deg(test_direction: str) -> str:
    s = (test_direction or "").strip().lower()
    if not s:
        return ""
    # Skip ambiguous dual-orientation labels ("horizontal (XY) vs vertical (Z)")
    if "vs" in s:
        return ""
    if "45" in s:
        return "45"
    if "horizontal" in s or "longitudinal" in s or "(xy)" in s:
        return "0"
    if "vertical" in s or "(z)" in s or "perpendicular to layers" in s:
        return "90"
    return ""


def parse_defect_type(defect_regime: str, notes: str) -> str:
    dr = (defect_regime or "").strip().lower()
    n = (notes or "").strip().lower()
    if dr == "lack_of_fusion":
        return "lof"
    if "keyhole" in dr or ("keyhole" in n and "pore" in n):
        return "keyhole_pore"
    if "gas pore" in n or "gas_pore" in dr:
        return "gas_pore"
    if dr == "conduction":
        return "none"
    return ""


def extract_dashboard_papers_db() -> Dict[int, Dict[str, Any]]:
    """Extracts verified P-59..P-78 summary records from PAPERS_DATABASE in dashboard HTML."""
    if not DASHBOARD_HTML.exists():
        return {}
    text = DASHBOARD_HTML.read_text(encoding="utf-8")
    m = re.search(r"const\s+PAPERS_DATABASE\s*=\s*\[([\s\S]*?)\];", text)
    if not m:
        return {}
    block = m.group(1)
    records: Dict[int, Dict[str, Any]] = {}
    # Match entries like { id: "P-59", author: "...", process: "...", desc: "...", density: "99.85%", ys: 890, uts: 1010, el: 12.8 }
    entry_re = re.compile(
        r'\{\s*id:\s*"P-(\d+)"\s*,\s*author:\s*"([^"]*)"\s*,\s*process:\s*"([^"]*)"\s*,\s*desc:\s*"([^"]*)"\s*,\s*density:\s*"([^"]*)"\s*,\s*ys:\s*(\d+(?:\.\d+)?)\s*,\s*uts:\s*(\d+(?:\.\d+)?)\s*,\s*el:\s*(\d+(?:\.\d+)?)\s*\}'
    )
    for match in entry_re.finditer(block):
        pnum = int(match.group(1))
        density_raw = match.group(5).replace("%", "").strip()
        records[pnum] = {
            "author": match.group(2),
            "process": match.group(3),
            "desc": match.group(4),
            "relative_density_pct": density_raw,
            "yield_strength_mpa": match.group(6),
            "ultimate_tensile_strength_mpa": match.group(7),
            "elongation_pct": match.group(8),
        }
    return records


def build_scopus_meta_map() -> Dict[int, Dict[str, str]]:
    rows = read_csv_rows(SCOPUS_CSV)
    out: Dict[int, Dict[str, str]] = {}
    for r in rows:
        try:
            pnum = int(r.get("paper_number", ""))
            out[pnum] = r
        except ValueError:
            continue
    return out


def make_backfill_note(paper: Dict[str, str], scopus_meta: Optional[Dict[str, str]]) -> str:
    proc = paper.get("am_process", "Unknown").strip()
    authors = paper.get("authors", "Unknown").strip()
    year = paper.get("year", "").strip()
    parts = [f"Indexed Ti-6Al-4V study ({proc}; {authors} {year})"]
    if scopus_meta:
        journal = (scopus_meta.get("journal") or "").strip()
        doi = (scopus_meta.get("doi") or "").strip()
        if journal:
            parts.append(journal)
        if doi:
            parts.append(f"DOI: {doi}")
    parts.append("Pending quantitative experimental extraction")
    return " | ".join(parts)


def sync_datasets() -> Dict[str, Any]:
    papers = read_csv_rows(PAPERS_CSV)
    papers_by_num: Dict[int, Dict[str, str]] = {}
    for p in papers:
        pnum = int(p["paper_number"])
        papers_by_num[pnum] = p

    scopus_map = build_scopus_meta_map()
    dash_db = extract_dashboard_papers_db()

    proc_rows = read_csv_rows(PROC_CSV)
    therm_rows = read_csv_rows(THERM_CSV)
    micro_rows = read_csv_rows(MICRO_CSV)
    mech_rows = read_csv_rows(MECH_CSV)

    proc_by_pnum = {int(r["paper_number"]): r for r in proc_rows if r.get("paper_number")}
    therm_by_pnum = {int(r["paper_number"]): r for r in therm_rows if r.get("paper_number")}
    micro_by_pnum = {int(r["paper_number"]): r for r in micro_rows if r.get("paper_number")}
    mech_by_pnum = {int(r["paper_number"]): r for r in mech_rows if r.get("paper_number")}

    # Preserve insertion order for existing records, then append missing papers prioritized by
    # WAAM -> L-DED -> Binder Jetting -> LPBF -> EBM/Other
    missing_order = sorted(
        papers_by_num.keys(),
        key=lambda n: (process_priority_rank(canonical_process_bucket(papers_by_num[n]["am_process"])), n),
    )

    def next_ordered_rows(
        existing_rows: List[Dict[str, str]],
        existing_map: Dict[int, Dict[str, str]],
    ) -> List[Dict[str, str]]:
        ordered: List[Dict[str, str]] = []
        seen = set()
        for r in existing_rows:
            pnum = int(r["paper_number"])
            if pnum not in seen and pnum in papers_by_num:
                ordered.append(dict(r))
                seen.add(pnum)
        next_id = max([int(r["id"]) for r in ordered if str(r.get("id", "")).isdigit()] + [0]) + 1
        for pnum in missing_order:
            if pnum not in seen:
                ordered.append({"id": str(next_id), "paper_number": str(pnum)})
                next_id += 1
                seen.add(pnum)
        return ordered

    new_proc_rows = next_ordered_rows(proc_rows, proc_by_pnum)
    new_therm_rows = next_ordered_rows(therm_rows, therm_by_pnum)
    new_micro_rows = next_ordered_rows(micro_rows, micro_by_pnum)
    new_mech_rows = next_ordered_rows(mech_rows, mech_by_pnum)

    # Enrich standardized columns strictly from verified workspace sources
    for r in new_proc_rows:
        pnum = int(r["paper_number"])
        paper = papers_by_num[pnum]
        if not r.get("scan_rotation_deg"):
            rot = parse_scan_rotation_deg(r.get("scan_strategy", ""))
            if rot:
                r["scan_rotation_deg"] = rot
        verified = VERIFIED_PAPER_OXYGEN_REUSE.get(pnum, {})
        if not r.get("oxygen_wt_pct") and verified.get("oxygen_wt_pct"):
            r["oxygen_wt_pct"] = verified["oxygen_wt_pct"]
        if not r.get("powder_reuse_cycles") and verified.get("powder_reuse_cycles"):
            r["powder_reuse_cycles"] = verified["powder_reuse_cycles"]
        if not (r.get("notes") or "").strip():
            r["notes"] = make_backfill_note(paper, scopus_map.get(pnum))

    therm_defect_by_pnum: Dict[int, Tuple[str, str]] = {}
    for r in new_therm_rows:
        pnum = int(r["paper_number"])
        paper = papers_by_num[pnum]
        if not r.get("defect_type"):
            dtype = parse_defect_type(r.get("defect_regime", ""), r.get("notes", ""))
            if dtype:
                r["defect_type"] = dtype
        if not (r.get("notes") or "").strip():
            r["notes"] = make_backfill_note(paper, scopus_map.get(pnum))
        therm_defect_by_pnum[pnum] = (r.get("defect_type", ""), r.get("max_defect_size_um", ""))

    for r in new_micro_rows:
        pnum = int(r["paper_number"])
        paper = papers_by_num[pnum]
        if not r.get("alpha_lath_width_um") and r.get("alpha_lath_thickness_um"):
            r["alpha_lath_width_um"] = r["alpha_lath_thickness_um"]
        verified = VERIFIED_PAPER_OXYGEN_REUSE.get(pnum, {})
        if not r.get("oxygen_wt_pct") and verified.get("oxygen_wt_pct"):
            r["oxygen_wt_pct"] = verified["oxygen_wt_pct"]
        if not (r.get("notes") or "").strip():
            r["notes"] = make_backfill_note(paper, scopus_map.get(pnum))

    for r in new_mech_rows:
        pnum = int(r["paper_number"])
        paper = papers_by_num[pnum]
        # Ingest verified P-59..P-78 summary properties from PAPERS_DATABASE if row was empty
        if pnum in dash_db and not r.get("yield_strength_mpa"):
            drec = dash_db[pnum]
            r["yield_strength_mpa"] = drec["yield_strength_mpa"]
            r["ultimate_tensile_strength_mpa"] = drec["ultimate_tensile_strength_mpa"]
            r["elongation_pct"] = drec["elongation_pct"]
            r["relative_density_pct"] = drec["relative_density_pct"]
            if not (r.get("notes") or "").strip():
                r["notes"] = f"Verified dashboard summary ({drec['author']}): {drec['desc']}"
        if not r.get("build_orientation_deg"):
            ori = parse_build_orientation_deg(r.get("test_direction", ""))
            if ori:
                r["build_orientation_deg"] = ori
        verified = VERIFIED_PAPER_OXYGEN_REUSE.get(pnum, {})
        if not r.get("oxygen_wt_pct") and verified.get("oxygen_wt_pct"):
            r["oxygen_wt_pct"] = verified["oxygen_wt_pct"]
        dtype, dmax = therm_defect_by_pnum.get(pnum, ("", ""))
        if not r.get("defect_type") and dtype:
            r["defect_type"] = dtype
        if not r.get("max_defect_size_um") and dmax:
            r["max_defect_size_um"] = dmax
        if not (r.get("notes") or "").strip():
            r["notes"] = make_backfill_note(paper, scopus_map.get(pnum))

    proc_cols = PROC_BASE_COLS + PROC_NEW_COLS
    therm_cols = THERM_BASE_COLS + THERM_NEW_COLS
    micro_cols = MICRO_BASE_COLS + MICRO_NEW_COLS
    mech_cols = MECH_BASE_COLS + MECH_NEW_COLS

    write_csv_rows(PROC_CSV, proc_cols, new_proc_rows)
    write_csv_rows(THERM_CSV, therm_cols, new_therm_rows)
    write_csv_rows(MICRO_CSV, micro_cols, new_micro_rows)
    write_csv_rows(MECH_CSV, mech_cols, new_mech_rows)

    # Build concise backfill coverage & gap report
    def table_coverage(rows: List[Dict[str, str]], cols: List[str]) -> Dict[str, Any]:
        total = len(rows)
        per_col: Dict[str, Any] = {}
        for c in cols:
            if c in ("id", "paper_number", "notes"):
                continue
            pop = sum(1 for r in rows if (r.get(c) or "").strip() != "")
            per_col[c] = {
                "populated": pop,
                "missing": total - pop,
                "coverage_pct": round((pop / max(1, total)) * 100.0, 1),
            }
        return {"total_rows": total, "columns": per_col}

    process_buckets: Dict[str, Dict[str, Any]] = {}
    proc_map = {int(r["paper_number"]): r for r in new_proc_rows}
    therm_map = {int(r["paper_number"]): r for r in new_therm_rows}
    micro_map = {int(r["paper_number"]): r for r in new_micro_rows}
    mech_map = {int(r["paper_number"]): r for r in new_mech_rows}

    for pnum, paper in sorted(papers_by_num.items()):
        b = canonical_process_bucket(paper["am_process"])
        if b not in process_buckets:
            process_buckets[b] = {
                "total_papers": 0,
                "has_process_params": 0,
                "has_thermal_physics": 0,
                "has_microstructure": 0,
                "has_mechanical_props": 0,
                "has_oxygen_wt_pct": 0,
                "has_alpha_lath_width_um": 0,
                "has_scan_rotation_deg": 0,
                "has_build_orientation_deg": 0,
                "has_defect_type": 0,
                "has_max_defect_size_um": 0,
            }
        sb = process_buckets[b]
        sb["total_papers"] += 1
        pr = proc_map.get(pnum, {})
        tr = therm_map.get(pnum, {})
        mr = micro_map.get(pnum, {})
        mpr = mech_map.get(pnum, {})
        if (pr.get("laser_power_w") or pr.get("scan_speed_mms") or "").strip():
            sb["has_process_params"] += 1
        if (tr.get("melt_pool_width_um") or tr.get("cooling_rate_k_s") or tr.get("residual_stress_mpa") or "").strip():
            sb["has_thermal_physics"] += 1
        if (mr.get("phases_identified") or mr.get("alpha_lath_width_um") or "").strip():
            sb["has_microstructure"] += 1
        if (mpr.get("yield_strength_mpa") or mpr.get("vickers_hardness_hv") or "").strip():
            sb["has_mechanical_props"] += 1
        if (pr.get("oxygen_wt_pct") or mpr.get("oxygen_wt_pct") or "").strip():
            sb["has_oxygen_wt_pct"] += 1
        if (mr.get("alpha_lath_width_um") or "").strip():
            sb["has_alpha_lath_width_um"] += 1
        if (pr.get("scan_rotation_deg") or "").strip():
            sb["has_scan_rotation_deg"] += 1
        if (mpr.get("build_orientation_deg") or "").strip():
            sb["has_build_orientation_deg"] += 1
        if (tr.get("defect_type") or "").strip():
            sb["has_defect_type"] += 1
        if (tr.get("max_defect_size_um") or "").strip():
            sb["has_max_defect_size_um"] += 1

    report = {
        "total_indexed_papers": len(papers_by_num),
        "relational_row_counts": {
            "ti64_process_parameters": len(new_proc_rows),
            "ti64_thermal_physics": len(new_therm_rows),
            "ti64_microstructure": len(new_micro_rows),
            "ti64_mechanical_properties": len(new_mech_rows),
        },
        "zero_fabrication_policy": "Only verified workspace records ingested; missing experimental fields left blank.",
        "by_process_bucket": process_buckets,
        "table_column_coverage": {
            "ti64_process_parameters": table_coverage(new_proc_rows, proc_cols),
            "ti64_thermal_physics": table_coverage(new_therm_rows, therm_cols),
            "ti64_microstructure": table_coverage(new_micro_rows, micro_cols),
            "ti64_mechanical_properties": table_coverage(new_mech_rows, mech_cols),
        },
    }
    REPORT_JSON.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    summary = sync_datasets()
    print(f"Synced {summary['total_indexed_papers']} papers across 4 relational CSVs.")
    print(json.dumps(summary["by_process_bucket"], indent=2))
