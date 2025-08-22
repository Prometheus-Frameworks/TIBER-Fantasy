import nfl_data_py as nfl
import pandas as pd
import argparse
from pathlib import Path

def parse_weeks(arg):
    if "-" in arg:
        a,b = arg.split("-")
        return list(range(int(a), int(b)+1))
    return [int(w) for w in arg.split(",")]

def main(year=2024, weeks_str="1-17", ppr=True, outdir="data"):
    weeks = parse_weeks(weeks_str)
    positions = ["QB","RB","WR","TE"]
    fp_col = "fantasy_points_ppr" if ppr else "fantasy_points"

    out_path = Path(outdir) / f"player_vs_defense_{year}.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    wrote = False
    for wk in weeks:
        print(f"Processing week {wk}...")
        df = nfl.import_weekly_data([year])
        df = df[(df["season"]==year) & (df["season_type"]=="REG") & (df["week"]==wk)]
        df = df[df["position"].isin(positions)]

        keep = df[[
            "season","week","opponent_team","position","player_name","recent_team",fp_col,"player_id"
        ]].rename(columns={
            "opponent_team":"def_team",
            "recent_team":"player_team",
            fp_col:"fpts"
        })

        # Drop rows with missing name or fpts
        keep = keep[keep["player_name"].notna() & keep["fpts"].notna()]

        mode = "w" if not wrote else "a"
        keep.to_csv(out_path, index=False, mode=mode, header=(not wrote))
        wrote = True
        print(f"Wrote week {wk}: {len(keep)} rows")

    print(f"OK: {out_path} generated")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--year", type=int, default=2024)
    p.add_argument("--weeks", type=str, default="1-17")
    p.add_argument("--ppr", action="store_true", default=True)
    p.add_argument("--outdir", type=str, default="data")
    args = p.parse_args()
    main(year=args.year, weeks_str=args.weeks, ppr=args.ppr, outdir=args.outdir)