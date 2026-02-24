#!/usr/bin/env python3
"""
CATALYST Score Calculator
Contextual Adaptive Tactical Leverage Yield Score

Computes per-player CATALYST scores from play-by-play data.
Factors: EPA base value, sigmoid leverage (WPA), opponent adjustment,
game-script factor, and recency decay.

Output: catalyst_raw (weighted mean) + catalyst_alpha (0-100 percentile)
Stored per player/season/week (cumulative through that week).
"""

import os
import sys
import numpy as np
from scipy.special import expit
import psycopg2
from psycopg2.extras import execute_values

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL is required")

MIN_PLAYS = 30
DECAY_RATE = 0.94
ROLE_MULT = {"QB": 1.0, "RB": 1.25, "WR": 1.15, "TE": 1.10}
POSITIONS = ["QB", "RB", "WR", "TE"]


def fetch_pbp(cur, season):
    cur.execute("""
        SELECT
            passer_player_id, passer_player_name,
            rusher_player_id, rusher_player_name,
            receiver_player_id, receiver_player_name,
            play_type, epa, wpa, wp, score_differential,
            defteam, posteam, week, season
        FROM bronze_nflfastr_plays
        WHERE season = %s
          AND epa IS NOT NULL
          AND wpa IS NOT NULL
          AND play_type IN ('pass', 'run')
        ORDER BY week, play_id
    """, (season,))
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    print(f"  Fetched {len(rows):,} plays for {season}")
    return cols, rows


def fetch_opponent_strength(cur, season):
    cur.execute("""
        SELECT def_team, position,
               AVG(fp_allowed) as mean_fp,
               STDDEV(fp_allowed) as std_fp
        FROM defense_dvp
        WHERE season = %s
        GROUP BY def_team, position
    """, (season,))
    rows = cur.fetchall()
    league_means = {}
    league_stds = {}
    team_pos_fp = {}
    for def_team, pos, mean_fp, std_fp in rows:
        team_pos_fp[(def_team, pos)] = mean_fp
        if pos not in league_means:
            league_means[pos] = []
        league_means[pos].append(mean_fp)

    pos_mean = {p: np.mean(v) for p, v in league_means.items()}
    pos_std = {p: np.std(v) if np.std(v) > 0 else 1.0 for p, v in league_means.items()}

    strength_z = {}
    for (def_team, pos), fp in team_pos_fp.items():
        z = (fp - pos_mean.get(pos, 15)) / pos_std.get(pos, 1.0)
        strength_z[(def_team, pos)] = z

    print(f"  Built opponent strength z-scores for {len(strength_z)} team-position combos")
    return strength_z


def assign_plays_to_players(cols, rows):
    plays_by_player = {}
    ci = {c: i for i, c in enumerate(cols)}

    for row in rows:
        epa = row[ci["epa"]]
        wpa = row[ci["wpa"]]
        score_diff = row[ci["score_differential"]]
        defteam = row[ci["defteam"]]
        posteam = row[ci["posteam"]]
        week = row[ci["week"]]
        play_type = row[ci["play_type"]]

        play_data = {
            "epa": epa, "wpa": wpa, "score_diff": score_diff,
            "defteam": defteam, "posteam": posteam, "week": week,
        }

        if play_type == "pass":
            pid = row[ci["passer_player_id"]]
            pname = row[ci["passer_player_name"]]
            if pid:
                plays_by_player.setdefault(pid, {"name": pname, "pos": "QB", "team": posteam, "plays": []})
                plays_by_player[pid]["plays"].append(play_data)

            rid = row[ci["receiver_player_id"]]
            rname = row[ci["receiver_player_name"]]
            if rid:
                plays_by_player.setdefault(rid, {"name": rname, "pos": "WR", "team": posteam, "plays": []})
                plays_by_player[rid]["plays"].append(play_data)

        elif play_type == "run":
            rid = row[ci["rusher_player_id"]]
            rname = row[ci["rusher_player_name"]]
            if rid:
                plays_by_player.setdefault(rid, {"name": rname, "pos": "RB", "team": posteam, "plays": []})
                plays_by_player[rid]["plays"].append(play_data)

    print(f"  Assigned plays to {len(plays_by_player)} players")
    return plays_by_player


_pos_cache = {}

def resolve_position(gsis_id, default_pos, cur):
    if gsis_id in _pos_cache:
        return _pos_cache[gsis_id]
    cur.execute("""
        SELECT position FROM player_identity_map
        WHERE gsis_id = %s OR nflfastr_gsis_id = %s
        LIMIT 1
    """, (gsis_id, gsis_id))
    row = cur.fetchone()
    pos = None
    if row and row[0] in POSITIONS:
        pos = row[0]
    else:
        pos = default_pos if default_pos in POSITIONS else None
    _pos_cache[gsis_id] = pos
    return pos


def compute_catalyst_through_week(player_plays, position, max_week, strength_z):
    plays = [p for p in player_plays if p["week"] <= max_week]
    if len(plays) < MIN_PLAYS:
        return None

    epa_arr = np.array([float(p["epa"]) for p in plays], dtype=np.float64)
    wpa_arr = np.abs(np.array([float(p["wpa"]) for p in plays], dtype=np.float64))

    leverage = 1.0 + 5.0 * expit(6.0 * (wpa_arr - 0.08))

    role_mult = ROLE_MULT.get(position, 1.0)
    opp_factors = np.array([
        np.exp(0.15 * strength_z.get((p["defteam"], position), 0.0)) * role_mult
        for p in plays
    ])

    script_factors = np.ones(len(plays))
    for i, p in enumerate(plays):
        sd = p.get("score_diff")
        if sd is not None and sd < 0 and abs(sd) <= 8:
            script_factors[i] = 1.2

    weeks = np.array([p["week"] for p in plays])
    decay = np.power(DECAY_RATE, max_week - weeks)

    weights = leverage * opp_factors * script_factors * decay
    weight_sum = weights.sum()
    if weight_sum <= 0:
        return None

    base_epa_sum = float(epa_arr.sum())
    weighted_epa_sum = float((epa_arr * weights).sum())
    play_count = len(plays)
    catalyst_raw = weighted_epa_sum / play_count

    if not np.isfinite(catalyst_raw):
        return None

    components = {
        "leverage_factor": round(float(leverage.mean()), 4),
        "opponent_factor": round(float(opp_factors.mean()), 4),
        "script_factor": round(float(script_factors.mean()), 4),
        "recency_factor": round(float(decay.mean()), 4),
        "base_epa_sum": round(base_epa_sum, 4),
        "weighted_epa_sum": round(weighted_epa_sum, 4),
        "play_count": play_count,
        "avg_leverage": round(float(leverage.mean()), 4),
    }

    for key, val in components.items():
        if isinstance(val, float) and not np.isfinite(val):
            components[key] = 0.0

    return {
        "catalyst_raw": round(catalyst_raw, 4),
        "components": components,
        "play_count": play_count,
    }


def compute_percentiles(results_by_pos):
    for pos, players in results_by_pos.items():
        raw_scores = sorted([p["catalyst_raw"] for p in players])
        n = len(raw_scores)
        if n == 0:
            continue
        for p in players:
            rank = sum(1 for s in raw_scores if s <= p["catalyst_raw"])
            p["catalyst_alpha"] = round(100.0 * rank / n, 1)
        print(f"  {pos}: {n} players, raw range [{raw_scores[0]:.3f}, {raw_scores[-1]:.3f}]")


def run_catalyst(season):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print(f"\n{'='*60}")
    print(f"CATALYST Calculator — Season {season}")
    print(f"{'='*60}")

    print("\n[1/5] Fetching play-by-play data...")
    cols, rows = fetch_pbp(cur, season)

    print("\n[2/5] Building opponent strength z-scores...")
    strength_z = fetch_opponent_strength(cur, season)

    print("\n[3/5] Assigning plays to players...")
    plays_by_player = assign_plays_to_players(cols, rows)

    print("\n[4/5] Computing CATALYST scores...")
    max_week_global = max(r[cols.index("week")] for r in rows)
    print(f"  Max week: {max_week_global}")

    all_results = []
    results_by_pos = {pos: [] for pos in POSITIONS}

    for gsis_id, pdata in plays_by_player.items():
        pos = resolve_position(gsis_id, pdata["pos"], cur)
        if pos is None or pos not in POSITIONS:
            continue

        for week in range(1, max_week_global + 1):
            result = compute_catalyst_through_week(pdata["plays"], pos, week, strength_z)
            if result is None:
                continue

            entry = {
                "gsis_id": gsis_id,
                "player_name": pdata["name"],
                "position": pos,
                "team": pdata["team"],
                "season": season,
                "week": week,
                "catalyst_raw": result["catalyst_raw"],
                "catalyst_alpha": 0.0,
                "components": result["components"],
            }
            all_results.append(entry)

            if week == max_week_global:
                results_by_pos[pos].append(entry)

    print(f"  Computed {len(all_results)} total player-week scores")

    print("\n[5/5] Computing per-week position percentiles...")
    results_by_week_pos: dict = {}
    for entry in all_results:
        key = (entry["week"], entry["position"])
        results_by_week_pos.setdefault(key, []).append(entry)

    for (week, pos), players in results_by_week_pos.items():
        raw_scores = sorted([p["catalyst_raw"] for p in players])
        n = len(raw_scores)
        if n == 0:
            continue
        for p in players:
            rank = sum(1 for s in raw_scores if s <= p["catalyst_raw"])
            p["catalyst_alpha"] = round(100.0 * rank / n, 1)

    week_pos_counts = {}
    for (week, pos), players in results_by_week_pos.items():
        week_pos_counts.setdefault(pos, []).append(len(players))
    for pos in POSITIONS:
        counts = week_pos_counts.get(pos, [])
        if counts:
            print(f"  {pos}: {len(counts)} weeks, avg {sum(counts)/len(counts):.0f} players/week")

    print(f"\n  Writing {len(all_results)} rows to catalyst_scores...")
    cur.execute("DELETE FROM catalyst_scores WHERE season = %s", (season,))
    print(f"  Cleared {cur.rowcount} existing rows")

    if all_results:
        from psycopg2.extras import Json
        values = [
            (r["gsis_id"], r["player_name"], r["position"], r["team"],
             r["season"], r["week"], r["catalyst_raw"], r["catalyst_alpha"],
             Json(r["components"]))
            for r in all_results
        ]
        execute_values(cur, """
            INSERT INTO catalyst_scores
                (gsis_id, player_name, position, team, season, week,
                 catalyst_raw, catalyst_alpha, components)
            VALUES %s
        """, values, page_size=500)

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n  Done! Inserted {len(all_results)} CATALYST scores for {season}")

    print(f"\n{'='*60}")
    print("Top 10 by position (final week):")
    print(f"{'='*60}")
    final_week_key = {}
    for entry in all_results:
        if entry["week"] == max_week_global:
            final_week_key.setdefault(entry["position"], []).append(entry)
    for pos in POSITIONS:
        players = sorted(final_week_key.get(pos, []), key=lambda x: x["catalyst_raw"], reverse=True)[:10]
        print(f"\n  {pos}:")
        for i, p in enumerate(players):
            print(f"    {i+1}. {p['player_name']:25s} raw={p['catalyst_raw']:+.3f}  alpha={p['catalyst_alpha']:.0f}  plays={p['components']['play_count']}")


if __name__ == "__main__":
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    run_catalyst(season)
