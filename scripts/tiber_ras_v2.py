#!/usr/bin/env python3
"""Compute TIBER RAS v2 scores for 2026 rookies using historical combine data (1987-2025)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

import nfl_data_py as nfl
import numpy as np
import pandas as pd

POSITIONS = ("QB", "RB", "WR", "TE")

# nfl_data_py column name -> our JSON field name
METRIC_MAP = {
    "forty":      "forty",
    "vertical":   "vert",
    "broad_jump": "broad",
    "cone":       "cone",
    "shuttle":    "shuttle",
    "ht":         "ht",
    "wt":         "wt",
}

LOWER_IS_BETTER = {"forty", "cone", "shuttle"}

INPUT_FILE = Path("data/rookies/2026_rookie_grades.json")
OUTPUT_FILE = Path("data/rookies/2026_rookie_grades_v2.json")


def _to_float(value: object) -> Optional[float]:
    if value in (None, "", "NA", "N/A", "null"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_height_to_inches(ht_val: object) -> Optional[float]:
    """Convert '6-2' or '6-02' format to decimal inches."""
    if ht_val is None:
        return None
    s = str(ht_val).strip()
    if "-" in s:
        parts = s.split("-")
        try:
            return float(parts[0]) * 12 + float(parts[1])
        except (ValueError, IndexError):
            return None
    return _to_float(ht_val)


def build_distributions(combine_df: pd.DataFrame) -> Dict[str, Dict[str, np.ndarray]]:
    distributions: Dict[str, Dict[str, np.ndarray]] = {}
    combine_df = combine_df.copy()
    combine_df["pos"] = combine_df["pos"].astype(str).str.upper().str.strip()

    # Convert height from "6-2" string format to decimal inches
    if "ht" in combine_df.columns:
        combine_df["ht_inches"] = combine_df["ht"].apply(parse_height_to_inches)

    for pos in POSITIONS:
        pos_df = combine_df.loc[combine_df["pos"] == pos]
        distributions[pos] = {}
        for nfl_col in METRIC_MAP:
            # Use converted height column
            col = "ht_inches" if nfl_col == "ht" else nfl_col
            if col not in pos_df.columns:
                distributions[pos][nfl_col] = np.array([])
                continue
            series = pd.to_numeric(pos_df[col], errors="coerce").dropna()
            if series.empty:
                distributions[pos][nfl_col] = np.array([])
            else:
                distributions[pos][nfl_col] = np.sort(series.to_numpy(dtype=float))

        pos_counts = {m: distributions[pos][m].size for m in METRIC_MAP}
        print(f"  {pos}: {len(pos_df)} historical players | metrics: {pos_counts}")

    return distributions


def percentile_score(value: float, sorted_values: np.ndarray, lower_is_better: bool) -> Optional[float]:
    n = sorted_values.size
    if n == 0:
        return None
    if lower_is_better:
        idx = np.searchsorted(sorted_values, value, side="left")
        percentile = (n - idx) / n
    else:
        idx = np.searchsorted(sorted_values, value, side="right")
        percentile = idx / n
    return float(np.clip(percentile * 10.0, 0.0, 10.0))


def score_player(player: dict, distributions: Dict[str, Dict[str, np.ndarray]]) -> Optional[float]:
    position = str(player.get("pos", player.get("position", ""))).upper().strip()
    if position not in distributions:
        return None

    metric_scores: List[float] = []
    for nfl_col, json_field in METRIC_MAP.items():
        raw_value = _to_float(player.get(json_field))
        if raw_value is None:
            continue
        dist = distributions[position].get(nfl_col, np.array([]))
        score = percentile_score(raw_value, dist, lower_is_better=nfl_col in LOWER_IS_BETTER)
        if score is not None:
            metric_scores.append(score)

    if not metric_scores:
        return None

    return round(float(np.mean(metric_scores)), 2)


def main() -> None:
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_FILE}")

    print("Pulling historical combine data (1987-2025)...")
    combine_df = nfl.import_combine_data(range(1987, 2026))
    print(f"Historical combine rows: {len(combine_df)}")

    print("Building position-stratified percentile distributions...")
    distributions = build_distributions(combine_df)

    with INPUT_FILE.open("r", encoding="utf-8") as infile:
        data = json.load(infile)

    # Support both flat array and { meta, players } format
    if isinstance(data, list):
        players = data
        output_data = players
    else:
        players = data.get("players", [])
        output_data = data

    print(f"\nScoring {len(players)} 2026 rookies against historical distributions...")
    scored = 0
    for player in players:
        if isinstance(player, dict):
            v2 = score_player(player, distributions)
            player["tiber_ras_v2"] = v2
            if v2 is not None:
                scored += 1

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", encoding="utf-8") as outfile:
        json.dump(output_data, outfile, indent=2, ensure_ascii=False)

    print(f"\n✅ TIBER-RAS v2 complete: {scored}/{len(players)} players scored")
    print(f"Output: {OUTPUT_FILE}")

    # Print top 5 per position
    for pos in POSITIONS:
        pos_players = [p for p in players if str(p.get("pos", p.get("position",""))).upper() == pos and p.get("tiber_ras_v2") is not None]
        pos_players.sort(key=lambda p: p["tiber_ras_v2"], reverse=True)
        print(f"\nTop {pos} by TIBER-RAS v2:")
        for p in pos_players[:3]:
            print(f"  {p['name']}: v1={p.get('tiber_ras')} v2={p['tiber_ras_v2']}")


if __name__ == "__main__":
    main()
