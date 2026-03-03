#!/usr/bin/env python3
"""
FORGE-R Phase 2: College Production Intake
Sources:
  - Individual stats: cfbfastR 2024 play-by-play (public GitHub CSV)
  - Team totals:     ESPN public stats API (no key required)
Outputs: data/rookies/2026_college_production.json
"""

import json
import time
import requests
import pandas as pd
from collections import defaultdict

ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football"
CFBFASTR_URL = (
    "https://github.com/sportsdataverse/cfbfastR-data/raw/main"
    "/player_stats/csv/player_stats_2024.csv"
)
SEASON = 2024

# ─────────────────────────────────────────────────────────────────────────────
# School → ESPN team ID
# ─────────────────────────────────────────────────────────────────────────────
SCHOOL_ESPN_ID = {
    "Alabama": 333,
    "Arizona State": 9,
    "Arkansas": 8,
    "Baylor": 239,
    "Cincinnati": 2132,
    "Clemson": 228,
    "Florida": 57,
    "Georgia": 61,
    "Georgia State": 2247,
    "Georgia Tech": 59,
    "Houston": 248,
    "Illinois": 356,
    "Incarnate Word": 2764,
    "Indiana": 84,
    "Iowa": 2294,
    "Kansas": 2309,
    "Kentucky": 96,
    "LSU": 99,
    "Louisville": 97,
    "Miami (FL)": 2390,
    "Michigan": 130,
    "Mississippi State": 344,
    "Missouri": 142,
    "Navy": 2426,
    "Nebraska": 158,
    "North Dakota State": 2449,
    "Notre Dame": 87,
    "Ohio State": 194,
    "Oklahoma": 201,
    "Ole Miss": 145,
    "Oregon": 2483,
    "Penn State": 213,
    "SMU": 2567,
    "South Carolina": 2579,
    "Stanford": 24,
    "Tennessee": 2633,
    "Texas": 251,
    "Texas A&M": 245,
    "Texas Tech": 2641,
    "UConn": 41,
    "USC": 30,
    "UTSA": 2636,
    "Utah": 254,
    "Vanderbilt": 238,
    "Wake Forest": 154,
    "Washington": 264,
    "Wisconsin": 275,
    "Wyoming": 278,
}

# cfbfastR team names differ slightly from our college field
SCHOOL_CFB_TEAM = {
    "Miami (FL)": "Miami",
    "Ole Miss": "Mississippi",
    "North Dakota State": "North Dakota St",
    "Georgia Tech": "Georgia Tech",
    "Ohio State": "Ohio State",
    "Arizona State": "Arizona State",
    "Penn State": "Penn State",
}


def normalize_name(name: str) -> str:
    """Normalize player name for matching."""
    return (
        name.lower()
        .replace("jr.", "").replace("sr.", "").replace("ii", "").replace("iii", "")
        .replace(".", "").replace(",", "").strip()
    )


def cfb_team_key(school: str | None) -> str:
    if not school:
        return ""
    return SCHOOL_CFB_TEAM.get(school, school.split("(")[0].strip())


# ─────────────────────────────────────────────────────────────────────────────
# Load cfbfastR play-by-play and aggregate into season totals
# ─────────────────────────────────────────────────────────────────────────────
def build_cfb_stats(pbp: pd.DataFrame) -> dict:
    """
    Aggregate play-by-play into per-player season stats.
    Returns dict keyed by (normalized_name, team) -> stats dict.
    """
    # Receiving
    recv = (
        pbp[pbp["reception_player"].notna()]
        .groupby(["reception_player", "team"])
        .agg(receptions=("reception_yds", "count"), rec_yards=("reception_yds", "sum"))
        .reset_index()
    )

    # Targets (separate — not every play has target_player)
    tgts = (
        pbp[pbp["target_player"].notna()]
        .groupby(["target_player", "team"])
        .agg(targets=("target_stat", "count"))
        .reset_index()
    )

    # Rushing
    rush = (
        pbp[pbp["rush_player"].notna()]
        .groupby(["rush_player", "team"])
        .agg(carries=("rush_yds", "count"), rush_yards=("rush_yds", "sum"))
        .reset_index()
    )

    # TDs by player
    tds = (
        pbp[pbp["touchdown_player"].notna()]
        .groupby(["touchdown_player", "team"])
        .agg(tds=("touchdown_stat", "count"))
        .reset_index()
    )

    # QB passing (completions)
    comp = (
        pbp[pbp["completion_player"].notna()]
        .groupby(["completion_player", "team"])
        .agg(completions=("completion_yds", "count"), pass_yards=("completion_yds", "sum"))
        .reset_index()
    )

    # Build lookup by (norm_name, team)
    stats_map = defaultdict(dict)

    for _, row in recv.iterrows():
        key = (normalize_name(row["reception_player"]), row["team"])
        stats_map[key].update(
            {"receptions": int(row["receptions"]), "rec_yards": float(row["rec_yards"])}
        )

    for _, row in tgts.iterrows():
        key = (normalize_name(row["target_player"]), row["team"])
        stats_map[key]["targets"] = int(row["targets"])

    for _, row in rush.iterrows():
        key = (normalize_name(row["rush_player"]), row["team"])
        stats_map[key].update(
            {"carries": int(row["carries"]), "rush_yards": float(row["rush_yards"])}
        )

    for _, row in tds.iterrows():
        key = (normalize_name(row["touchdown_player"]), row["team"])
        stats_map[key]["tds"] = int(row["tds"])

    for _, row in comp.iterrows():
        key = (normalize_name(row["completion_player"]), row["team"])
        stats_map[key].update(
            {"completions": int(row["completions"]), "pass_yards": float(row["pass_yards"])}
        )

    return stats_map


def lookup_player(stats_map: dict, name: str, school: str) -> dict | None:
    """Find player in cfbfastR stats by name + school."""
    norm = normalize_name(name)
    team_key = cfb_team_key(school)

    # 1. Exact normalized name + fuzzy school
    candidates = [
        (k, v)
        for k, v in stats_map.items()
        if k[0] == norm and team_key.lower() in k[1].lower()
    ]
    if candidates:
        return max(candidates, key=lambda x: x[1].get("rec_yards", 0) + x[1].get("rush_yards", 0))[1]

    # 2. Exact normalized name any team
    candidates = [(k, v) for k, v in stats_map.items() if k[0] == norm]
    if candidates:
        return max(candidates, key=lambda x: x[1].get("rec_yards", 0) + x[1].get("rush_yards", 0))[1]

    # 3. Last name match + school
    last = normalize_name(name).split()[-1]
    candidates = [
        (k, v)
        for k, v in stats_map.items()
        if last in k[0] and team_key.lower() in k[1].lower()
    ]
    if len(candidates) == 1:
        return candidates[0][1]

    return None


# ─────────────────────────────────────────────────────────────────────────────
# ESPN team stats
# ─────────────────────────────────────────────────────────────────────────────
def get_espn_team_stats(espn_id: int) -> dict:
    url = f"{ESPN_BASE}/teams/{espn_id}/statistics?season={SEASON}"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        cats = r.json().get("results", {}).get("stats", {}).get("categories", [])
        result = {}
        for cat in cats:
            for stat in cat.get("stats", []):
                key = f"{cat['name']}_{stat['name']}"
                raw = stat.get("value", stat.get("displayValue", "0"))
                try:
                    result[key] = float(str(raw).replace(",", ""))
                except (ValueError, TypeError):
                    result[key] = None
        return result
    except Exception as e:
        print(f"    ⚠️  ESPN {espn_id}: {e}")
        return {}


def extract_team_totals(raw: dict) -> dict:
    return {
        "team_pass_yards": raw.get("passing_netPassingYards"),
        "team_pass_tds": raw.get("passing_passingTouchdowns"),
        "team_rush_yards": raw.get("rushing_rushingYards"),
        "team_rush_tds": raw.get("rushing_rushingTouchdowns"),
        "team_rec_tds": raw.get("receiving_receivingTouchdowns"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Scoring helpers
# ─────────────────────────────────────────────────────────────────────────────
def dominator_rating(p_yards, p_tds, t_yards, t_tds) -> float | None:
    """Share of team offensive production (0–100%)."""
    if None in (p_yards, t_yards) or t_yards == 0:
        return None
    denom = t_yards + 1.5 * (t_tds or 0)
    if denom == 0:
        return None
    return round(((p_yards + 1.5 * (p_tds or 0)) / denom) * 100, 2)


def percentile_in_group(val, group_vals) -> float | None:
    valid = [v for v in group_vals if v is not None]
    if not valid or val is None:
        return None
    return round(sum(1 for v in valid if v < val) / len(valid) * 100, 1)


def production_score(player: dict, pos_group: list, pos: str) -> float | None:
    """
    Weighted 0–100 score within position group.
    WR/TE: dominator 50%, yards 30%, tds 20%
    RB:    dominator 40%, yards 30%, ypc 20%, tds 10%
    QB:    yards 40%, comp% 40%, td% 20%
    """
    cs = player.get("cfb_stats", {}) or {}

    def pct(field, grp_field=None):
        vals = [p.get("cfb_stats", {}).get(grp_field or field) for p in pos_group]
        return percentile_in_group(cs.get(field), vals)

    def dr_pct():
        vals = [p.get("dominator_rating") for p in pos_group]
        return percentile_in_group(player.get("dominator_rating"), vals)

    if pos in ("WR", "TE"):
        scores = [
            (dr_pct(), 0.50),
            (pct("rec_yards"), 0.30),
            (pct("tds"), 0.20),
        ]
    elif pos == "RB":
        carries = cs.get("carries") or 0
        rush_yds = cs.get("rush_yards") or 0
        rush_ypc = rush_yds / max(carries, 1) if carries else None
        all_ypc = [
            (p.get("cfb_stats", {}).get("rush_yards") or 0)
            / max(p.get("cfb_stats", {}).get("carries") or 1, 1)
            if p.get("cfb_stats", {}).get("carries") else None
            for p in pos_group
        ]
        ypc_pct = percentile_in_group(rush_ypc, all_ypc)
        scores = [
            (dr_pct(), 0.40),
            (pct("rush_yards"), 0.30),
            (ypc_pct, 0.20),
            (pct("tds"), 0.10),
        ]
    elif pos == "QB":
        comp_pct_val = (
            cs.get("completions", 0) / cs.get("pass_attempts", 1)
            if cs.get("pass_attempts")
            else None
        )
        all_comp = [
            (p.get("cfb_stats", {}).get("completions", 0) or 0)
            / max(p.get("cfb_stats", {}).get("pass_attempts", 1) or 1, 1)
            for p in pos_group
            if p.get("cfb_stats", {}).get("pass_attempts")
        ]
        comp_pct_pct = percentile_in_group(comp_pct_val, all_comp)
        scores = [
            (pct("pass_yards"), 0.40),
            (comp_pct_pct, 0.40),
            (pct("tds"), 0.20),
        ]
    else:
        return None

    valid = [(s, w) for s, w in scores if s is not None]
    if not valid:
        return None
    total_w = sum(w for _, w in valid)
    return round(sum(s * w for s, w in valid) / total_w, 1)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("FORGE-R Phase 2: College Production Intake")
    print("=" * 60)

    # Load players
    combine = json.load(open("data/rookies/2026_combine_results.json"))
    players = combine["players"]
    print(f"\nLoaded {len(players)} players")

    # ── Step 1: Download cfbfastR PBP and build stats map ──────────────────
    print(f"\nDownloading cfbfastR 2024 play-by-play...")
    pbp = pd.read_csv(CFBFASTR_URL, low_memory=False)
    print(f"  {len(pbp):,} plays loaded")
    stats_map = build_cfb_stats(pbp)
    print(f"  {len(stats_map):,} unique player-team combinations indexed")

    # ── Step 2: Pull ESPN team totals ───────────────────────────────────────
    print(f"\nPulling ESPN team totals for {len(SCHOOL_ESPN_ID)} schools...")
    team_cache = {}
    for school, eid in SCHOOL_ESPN_ID.items():
        raw = get_espn_team_stats(eid)
        team_cache[school] = extract_team_totals(raw)
        time.sleep(0.25)
    print("  Done")

    # ── Step 3: Enrich each player ─────────────────────────────────────────
    print("\nEnriching players...")
    results = []
    found_cfb = 0

    for p in players:
        pos = p["pos"]
        school = p.get("college", "")
        team = team_cache.get(school, {})

        # Pull individual stats from cfbfastR
        cfb = lookup_player(stats_map, p["name"], school)
        if cfb:
            found_cfb += 1

        # Merge with any stats already in combine JSON (prefer cfbfastR when available)
        existing = p.get("college_last_season") or {}

        merged_stats: dict = {}
        if pos in ("WR", "TE"):
            merged_stats = {
                "receptions": cfb.get("receptions") if cfb else existing.get("rec"),
                "rec_yards": cfb.get("rec_yards") if cfb else existing.get("yards"),
                "targets": cfb.get("targets") if cfb else None,
                "tds": (cfb.get("tds") if cfb else existing.get("tds")),
                "ypr": (
                    round(cfb["rec_yards"] / cfb["receptions"], 1)
                    if cfb and cfb.get("receptions") and cfb.get("rec_yards")
                    else existing.get("avg")
                ),
            }
        elif pos == "RB":
            merged_stats = {
                "carries": cfb.get("carries") if cfb else existing.get("carries"),
                "rush_yards": cfb.get("rush_yards") if cfb else existing.get("rush_yards"),
                "tds": cfb.get("tds") if cfb else existing.get("rush_tds"),
                "receptions": cfb.get("receptions") if cfb else None,
                "rec_yards": cfb.get("rec_yards") if cfb else None,
                "rush_avg": (
                    round(cfb["rush_yards"] / cfb["carries"], 1)
                    if cfb and cfb.get("carries") and cfb.get("rush_yards")
                    else existing.get("rush_avg")
                ),
            }
        elif pos == "QB":
            merged_stats = {
                "completions": cfb.get("completions") if cfb else None,
                "pass_yards": cfb.get("pass_yards") if cfb else None,
                "pass_attempts": cfb.get("pass_attempts") if cfb else None,
                "tds": cfb.get("tds") if cfb else None,
            }

        # Dominator rating
        dr = None
        target_share = None
        ypc = None

        if pos in ("WR", "TE"):
            p_yds = merged_stats.get("rec_yards")
            p_tds = merged_stats.get("tds")
            t_yds = team.get("team_pass_yards")
            t_tds = team.get("team_rec_tds") or team.get("team_pass_tds")
            dr = dominator_rating(p_yds, p_tds, t_yds, t_tds)
            if p_yds and t_yds:
                target_share = round((p_yds / t_yds) * 100, 2)

        elif pos == "RB":
            p_yds = merged_stats.get("rush_yards")
            p_tds = merged_stats.get("tds")
            t_yds = team.get("team_rush_yards")
            t_tds = team.get("team_rush_tds")
            dr = dominator_rating(p_yds, p_tds, t_yds, t_tds)
            ypc = merged_stats.get("rush_avg")

        record = {
            "player_name": p["name"],
            "position": pos,
            "school": school,
            "cfb_stats": merged_stats,
            "cfb_source": "cfbfastr_2024" if cfb else ("combine_json" if any(v is not None for v in existing.values()) else "none"),
            "dominator_rating": dr,
            "college_target_share": target_share,
            "college_ypc": ypc,
            "production_score": None,
        }
        results.append(record)

    print(f"  cfbfastR match rate: {found_cfb}/{len(players)} players")

    # ── Step 4: Production scores within position group ─────────────────────
    print("\nComputing production scores...")
    by_pos = defaultdict(list)
    for r in results:
        by_pos[r["position"]].append(r)

    for pos, group in by_pos.items():
        for r in group:
            r["production_score"] = production_score(r, group, pos)

    # ── Step 5: Summary ─────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("TOP PRODUCTION SCORES BY POSITION")
    print("=" * 60)

    for pos in ["WR", "RB", "TE", "QB"]:
        group = sorted(
            [r for r in results if r["position"] == pos and r["production_score"] is not None],
            key=lambda x: x["production_score"],
            reverse=True,
        )
        print(f"\n{pos} (top 5):")
        for i, r in enumerate(group[:5], 1):
            dr_s = f"  DR={r['dominator_rating']:.1f}%" if r["dominator_rating"] else ""
            src = f"  [{r['cfb_source']}]"
            print(f"  {i}. {r['player_name']:<28} score={r['production_score']:5.1f}{dr_s}{src}")
        no_score = [r for r in results if r["position"] == pos and r["production_score"] is None]
        if no_score:
            print(f"  ⚠️  {len(no_score)} with no score: {[r['player_name'] for r in no_score]}")

    # ── Step 6: Save output ─────────────────────────────────────────────────
    full_coverage = sum(1 for r in results if r["cfb_source"] == "cfbfastr_2024")
    partial = sum(1 for r in results if r["cfb_source"] == "combine_json")
    no_data = sum(1 for r in results if r["cfb_source"] == "none")

    output = {
        "season": 2026,
        "generated_at": "2026-03-03",
        "sources": ["cfbfastR 2024 play-by-play (public GitHub)", "ESPN team stats API"],
        "coverage": {
            "total": len(results),
            "cfbfastr_matched": full_coverage,
            "combine_json_only": partial,
            "no_data": no_data,
        },
        "players": results,
    }

    path = "data/rookies/2026_college_production.json"
    with open(path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✅ Wrote {len(results)} records to {path}")
    print(f"   cfbfastR matched: {full_coverage}  |  combine JSON only: {partial}  |  no data: {no_data}")


if __name__ == "__main__":
    main()
