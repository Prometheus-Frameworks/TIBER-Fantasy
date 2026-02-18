#!/usr/bin/env python3
"""
IDP Lab — Bronze Layer ETL
Dataset: nflverse play-by-play (via nfl-data-py) + snap counts + player registry
Aggregates defensive stats per player per week into idp_player_week table.

Guaranteed MVP fields:
  tackles_solo, tackles_assist, tackles_total, sacks, tackles_for_loss,
  interceptions, passes_defended, forced_fumbles, fumble_recoveries, defense_snaps

Optional (nullable if unavailable):
  qb_hits, pressures

Usage:
  python3 server/modules/idp/ingestIdpWeekly.py 2024
  python3 server/modules/idp/ingestIdpWeekly.py 2024 1 17
"""

import sys
import os
import psycopg2
import nfl_data_py as nfl
import pandas as pd
from collections import defaultdict

NFL_TO_IDP = {
    "DE": "EDGE", "OLB": "EDGE", "EDGE": "EDGE",
    "DT": "DI", "NT": "DI", "DI": "DI",
    "ILB": "LB", "MLB": "LB", "LB": "LB",
    "CB": "CB", "NB": "CB",
    "SS": "S", "FS": "S", "S": "S", "DB": "S",
}

def build_player_registry():
    players = nfl.import_players()
    pos_by_gsis = {}
    name_by_gsis = {}
    team_by_gsis = {}
    for gsis, pos, name, team in zip(
        players["gsis_id"], players["position"],
        players["display_name"], players["latest_team"]
    ):
        if pd.isna(gsis):
            continue
        if pd.notna(pos):
            pos_by_gsis[gsis] = str(pos).upper().strip()
        if pd.notna(name):
            name_by_gsis[gsis] = str(name)
        if pd.notna(team):
            team_by_gsis[gsis] = str(team)
    return pos_by_gsis, name_by_gsis, team_by_gsis

def build_snap_lookup(season):
    snaps = nfl.import_snap_counts([season])
    ds = snaps[snaps["defense_snaps"] > 0][["player", "week", "defense_snaps"]].copy()
    ds["week"] = ds["week"].astype(int)
    ds["defense_snaps"] = ds["defense_snaps"].astype(int)
    lookup = {}
    for p, w, s in zip(ds["player"], ds["week"], ds["defense_snaps"]):
        lookup[(str(p), w)] = s
    return lookup

def aggregate_defensive_stats(pbp, start_week=None, end_week=None):
    reg = pbp[pbp["season_type"] == "REG"].copy()
    if start_week:
        reg = reg[reg["week"] >= start_week]
    if end_week:
        reg = reg[reg["week"] <= end_week]

    stats = defaultdict(lambda: defaultdict(lambda: [0, 0, 0.0, 0, 0, 0, 0, 0, 0]))
    pbp_names = {}

    def add(pid_col, name_col, idx, val=1):
        mask = reg[pid_col].notna()
        sub = reg.loc[mask, [pid_col, name_col, "week"]]
        for pid, nm, w in zip(sub[pid_col], sub[name_col], sub["week"]):
            stats[pid][int(w)][idx] += val
            if pd.notna(nm):
                pbp_names[pid] = str(nm)

    for i in range(1, 3):
        c = f"solo_tackle_{i}_player_id"
        if c in reg.columns:
            add(c, f"solo_tackle_{i}_player_name", 0)
    for i in range(1, 3):
        c = f"tackle_with_assist_{i}_player_id"
        if c in reg.columns:
            add(c, f"tackle_with_assist_{i}_player_name", 0)
    for i in range(1, 5):
        c = f"assist_tackle_{i}_player_id"
        if c in reg.columns:
            add(c, f"assist_tackle_{i}_player_name", 1)

    sack_mask = (reg["sack"] == 1) & reg["sack_player_id"].notna()
    sack_cols = ["sack_player_id", "sack_player_name", "week"]
    has_half = "half_sack" in reg.columns
    if has_half:
        sack_cols.append("half_sack")
    sack_plays = reg.loc[sack_mask, sack_cols]
    for idx_row in range(len(sack_plays)):
        row = sack_plays.iloc[idx_row]
        pid = row["sack_player_id"]
        nm = row["sack_player_name"]
        w = row["week"]
        half = row["half_sack"] if has_half else 0
        v = 0.5 if half == 1 else 1.0
        stats[pid][int(w)][2] += v
        if pd.notna(nm):
            pbp_names[pid] = str(nm)

    for i in range(1, 3):
        c = f"tackle_for_loss_{i}_player_id"
        if c in reg.columns:
            add(c, f"tackle_for_loss_{i}_player_name", 3)
    if "interception_player_id" in reg.columns:
        add("interception_player_id", "interception_player_name", 4)
    for i in range(1, 3):
        c = f"pass_defense_{i}_player_id"
        if c in reg.columns:
            add(c, f"pass_defense_{i}_player_name", 5)
    for i in range(1, 3):
        c = f"forced_fumble_player_{i}_player_id"
        if c in reg.columns:
            add(c, f"forced_fumble_player_{i}_player_name", 6)
    for i in range(1, 3):
        c = f"qb_hit_{i}_player_id"
        if c in reg.columns:
            add(c, f"qb_hit_{i}_player_name", 8)

    return stats, pbp_names

def main():
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    start_week = int(sys.argv[2]) if len(sys.argv) > 2 else None
    end_week = int(sys.argv[3]) if len(sys.argv) > 3 else None

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set"); sys.exit(1)

    print(f"[IDP ETL] Building player registry...")
    pos_by_gsis, name_by_gsis, team_by_gsis = build_player_registry()
    print(f"[IDP ETL] Registry: {len(pos_by_gsis)} players")

    print(f"[IDP ETL] Loading PBP for {season}...")
    pbp = nfl.import_pbp_data([season])
    print(f"[IDP ETL] PBP: {len(pbp)} plays")

    print(f"[IDP ETL] Aggregating defensive stats...")
    stats, pbp_names = aggregate_defensive_stats(pbp, start_week, end_week)
    print(f"[IDP ETL] {len(stats)} players with defensive plays")

    print(f"[IDP ETL] Loading snap counts...")
    snap_lookup = build_snap_lookup(season)
    print(f"[IDP ETL] {len(snap_lookup)} snap entries")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    upsert = """
        INSERT INTO idp_player_week (
            gsis_id, player_name, team, nfl_position, position_group,
            season, week, defense_snaps,
            tackles_solo, tackles_assist, tackles_total,
            sacks, tackles_for_loss, interceptions,
            passes_defended, forced_fumbles, fumble_recoveries,
            qb_hits, pressures, havoc_events, havoc_raw_rate
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (gsis_id, season, week) DO UPDATE SET
            player_name=EXCLUDED.player_name, team=EXCLUDED.team,
            nfl_position=EXCLUDED.nfl_position, position_group=EXCLUDED.position_group,
            defense_snaps=EXCLUDED.defense_snaps,
            tackles_solo=EXCLUDED.tackles_solo, tackles_assist=EXCLUDED.tackles_assist,
            tackles_total=EXCLUDED.tackles_total, sacks=EXCLUDED.sacks,
            tackles_for_loss=EXCLUDED.tackles_for_loss, interceptions=EXCLUDED.interceptions,
            passes_defended=EXCLUDED.passes_defended, forced_fumbles=EXCLUDED.forced_fumbles,
            fumble_recoveries=EXCLUDED.fumble_recoveries,
            qb_hits=EXCLUDED.qb_hits, pressures=EXCLUDED.pressures,
            havoc_events=EXCLUDED.havoc_events, havoc_raw_rate=EXCLUDED.havoc_raw_rate,
            ingested_at=NOW()
    """

    inserted = 0
    skipped = 0
    batch = []

    for gsis_id, weeks in stats.items():
        nfl_pos = pos_by_gsis.get(gsis_id)
        if not nfl_pos:
            skipped += 1; continue
        pos_group = NFL_TO_IDP.get(nfl_pos)
        if not pos_group:
            skipped += 1; continue

        name = name_by_gsis.get(gsis_id) or pbp_names.get(gsis_id, "Unknown")
        team = team_by_gsis.get(gsis_id)

        for week, s in weeks.items():
            def_snaps = snap_lookup.get((name, week), 0)
            tk_solo, tk_ast, sacks, tfl, ints, pds, ff, fr, qbh = s
            tackles_total = tk_solo + tk_ast
            havoc = int(sacks + tfl + ints + pds + ff + qbh)
            rate = havoc / def_snaps if def_snaps > 0 else None
            qbh_val = qbh if qbh > 0 else None

            batch.append((
                gsis_id, name, team, nfl_pos, pos_group,
                season, week, def_snaps,
                tk_solo, tk_ast, tackles_total,
                sacks, tfl, ints, pds, ff, fr,
                qbh_val, None, havoc, rate,
            ))
            inserted += 1

            if len(batch) >= 500:
                cur.executemany(upsert, batch)
                conn.commit()
                batch = []
                print(f"  ... {inserted} rows")

    if batch:
        cur.executemany(upsert, batch)
        conn.commit()

    cur.close()
    conn.close()
    print(f"[IDP ETL] Done. {inserted} inserted/updated, {skipped} skipped")

if __name__ == "__main__":
    main()
