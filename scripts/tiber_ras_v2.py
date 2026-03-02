#!/usr/bin/env python3
"""Compute TIBER RAS v2 scores for 2026 rookies using historical combine data."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

import nfl_data_py as nfl
import numpy as np
import pandas as pd

POSITIONS = ("QB", "RB", "WR", "TE")
METRICS = (
    "40yd",
    "ten_split",
    "vertical",
    "broad_jump",
    "three_cone",
    "shuttle",
    "height",
    "weight",
)
LOWER_IS_BETTER = {"40yd", "ten_split", "three_cone", "shuttle"}
INPUT_FILE = Path("data/rookies/2026_rookie_grades.json")
OUTPUT_FILE = Path("data/rookies/2026_rookie_grades_v2.json")


def _to_float(value: object) -> Optional[float]:
    if value in (None, "", "NA", "N/A", "null"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_distributions(combine_df: pd.DataFrame) -> Dict[str, Dict[str, np.ndarray]]:
    distributions: Dict[str, Dict[str, np.ndarray]] = {}

    combine_df = combine_df.copy()
    combine_df["pos"] = combine_df["pos"].astype(str).str.upper().str.strip()

    for pos in POSITIONS:
        pos_df = combine_df.loc[combine_df["pos"] == pos]
        distributions[pos] = {}
        for metric in METRICS:
            series = pd.to_numeric(pos_df.get(metric), errors="coerce").dropna()
            if series.empty:
                distributions[pos][metric] = np.array([])
            else:
                distributions[pos][metric] = np.sort(series.to_numpy(dtype=float))

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
    position = str(player.get("position", "")).upper().strip()
    if position not in distributions:
        return None

    metric_scores: List[float] = []
    for metric in METRICS:
        raw_value = _to_float(player.get(metric))
        if raw_value is None:
            continue

        score = percentile_score(
            raw_value,
            distributions[position][metric],
            lower_is_better=metric in LOWER_IS_BETTER,
        )
        if score is not None:
            metric_scores.append(score)

    if not metric_scores:
        return None

    return round(float(np.mean(metric_scores)), 2)


def main() -> None:
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_FILE}")

    combine_df = nfl.import_combine_data(range(1987, 2026))
    distributions = build_distributions(combine_df)

    with INPUT_FILE.open("r", encoding="utf-8") as infile:
        rookies = json.load(infile)

    if not isinstance(rookies, list):
        raise ValueError("Expected rookie grades input to be a JSON array of player objects.")

    for player in rookies:
        if isinstance(player, dict):
            player["tiber_ras_v2"] = score_player(player, distributions)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", encoding="utf-8") as outfile:
        json.dump(rookies, outfile, indent=2, ensure_ascii=False)

    print(f"Updated {len(rookies)} rookies -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
