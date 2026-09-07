"""Offline, pinned consumer transform. No downloads, identity inference or forecasts."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess

DATA_COMMIT = '8b762650f4b933b6ce717c551993dcaaf92e1008'
PINS = {
 'exports/promoted/draft_review/evidence_admission_v1.json': '603e52409c5d07820bc58c5c0b7d6df91e4eb7cdc31326633d1c24e35c34811c',
 'exports/promoted/identity_crosswalk/tiber_identity_crosswalk_v2.json': 'c0e5c32a20b0397ff22e994a0fd48ec16907b5909f0880e0ebd3c7c89f0f9809',
 'data/processed/evidence/player_weekly_usage_2025.source_backed.json': '30a8e17370270e2fa5d055c7a771f19af2fe7bd89282cd2373f7704a492412cb',
 'data/processed/evidence/player_weekly_ppr_outcomes_2025.source_backed.json': 'f241112115c9a625abead3410db89db6b4a8b603ce1dd663a45ff0697563e3a2',
}
COUNTS = ['targets', 'receptions', 'rushing_attempts', 'receiving_yards', 'receiving_tds', 'rushing_yards', 'rushing_tds', 'passing_yards', 'passing_tds', 'interceptions']
SHARES = ['target_share', 'air_yards_share']
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'server/modules/draftReview/artifacts/historical2025.json'

def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

def index(records):
    result = {}
    for row in records:
        if row['season'] != 2025 or not 1 <= row['week'] <= 18:
            continue
        key = (row['player_id'], row['week'])
        if key in result:
            raise ValueError('Duplicate weekly key')
        result[key] = row
    return result

def metric(values, share=False):
    valid = [v for v in values if number(v)]
    return {'total': sum(valid) if valid and len(valid) == len(values) and not share else None,
            'mean': sum(valid) / len(valid) if valid else None,
            'nonnull_weeks': len(valid), 'recorded_weeks': len(values)}

def profile(identity, outcomes, usage):
    player_id = identity['tiber_player_id']
    rows = sorted([r for (pid, _), r in outcomes.items() if pid == player_id], key=lambda r: r['week'])
    joined, conflicts, missing = [], [], []
    for row in rows:
        other = usage.get((player_id, row['week']))
        if other is None:
            missing.append(row['week']); joined.append(None)
        elif any(row.get(k) != other.get(k) for k in ['team', 'opponent', 'position']):
            conflicts.append(row['week']); joined.append(None)
        else:
            joined.append(other)
    return {
        'player_id': identity['provider_player_id'],
        'status': 'available' if rows else 'unavailable',
        'reason': None if rows else 'No recorded 2025 weeks in the admitted window.',
        'identity': {k: identity[k] for k in ['tiber_player_id', 'confidence', 'match_method']},
        'observed': {'weeks': [r['week'] for r in rows],
                     'historical_teams': sorted({r['team'] for r in rows if r.get('team')}),
                     'historical_positions': sorted({r['position'] for r in rows if r.get('position')}),
                     'usage_conflict_weeks': conflicts, 'usage_missing_weeks': missing},
        'derived': {**{k: metric([r.get(k) for r in rows]) for k in COUNTS},
                    **{k: metric([r.get(k) if r else None for r in joined], True) for k in SHARES}},
    }

def build(repo):
    loaded = []
    for path, expected in PINS.items():
        raw = subprocess.check_output(['git', '-C', str(repo), 'show', f'{DATA_COMMIT}:{path}'])
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError(f'Pinned source mismatch: {path}')
        loaded.append(json.loads(raw))
    admission, identities, usage, outcomes = loaded
    assert admission['status'] == 'accepted' and admission['merge_authorized'] is False and admission['production_deployment_authorized'] is False
    scope = admission['consumer_scope']
    assert scope['season'] == 2025 and scope['weeks'] == [1, 18]
    assert scope['outcome_fields'] == COUNTS and scope['usage_fields'] == SHARES
    selected = [r for r in identities['records'] if r['provider'] == 'sleeper']
    assert len({r['provider_player_id'] for r in selected}) == len(selected)
    oi, ui = index(outcomes['records']), index(usage['records'])
    return {
        'schema_version': 'tiber_draft_review_historical_v1',
        'window': {'season': 2025, 'week_start': 1, 'week_end': 18, 'period_basis': scope['period_basis']},
        'provenance': {
            'producer_repo': 'Prometheus-Frameworks/TIBER-Data', 'producer_commit': DATA_COMMIT,
            'sources': [{'path': p, 'sha256': h} for p, h in PINS.items()],
            'operator_acceptance': admission['operator_acceptance'],
            'source_acquired_at': None, 'source_updated_at': None, 'original_release_hash': None, 'package_version': None,
            'transform': 'TIBER filters 2025 weeks 1–18 and aggregates recorded observations; this is a downstream descriptive bundle.',
            'attribution': {'name': 'nflverse contributors', 'source_url': 'https://github.com/nflverse/nflverse-pbp', 'license': 'CC BY 4.0', 'license_url': 'https://creativecommons.org/licenses/by/4.0/', 'notice': 'No endorsement implied. Scoped terms assessment is dated 2026-09-07; original acquisition terms receipt is unavailable.'},
        },
        'limitations': [
            'Historical descriptive evidence only. No current role, injury, bye, value, regression probability or forecast is inferred.',
            'Recorded weeks are observations, not certified games played. Missing weeks are unknown, never zero, bye or DNP.',
            'Totals require all recorded values. Means use the displayed nonnull-week denominator. Average weekly share is not season share.',
            'Conflicting weekly team/opponent/position blocks joined usage derivations; independent outcome observations remain.',
            'Historical team and position come from 2025 records, separately from current Sleeper observations.',
            'Identity confidence is retained; accepted name_exact mappings remain medium confidence.',
            'No league fantasy points or scoring subtotals. Air-yards totals are excluded because legacy zero origin is ambiguous.',
        ],
        'unavailable_metrics': {k: None for k in scope['unavailable_usage_fields'] + ['air_yards', 'fantasy_points', 'regression_probability']},
        'forecast': {'status': 'unavailable', 'fabricated_values': False},
        'players': [profile(r, oi, ui) for r in selected],
    }

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-repo', required=True, type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    # Compact deterministic serialization bounds public packet size and keeps the source pins auditable.
    raw = (json.dumps(build(args.data_repo), sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False) + '\n').encode()
    if args.check:
        assert OUTPUT.read_bytes() == raw, 'Committed consumer bundle differs from deterministic replay'
    else:
        OUTPUT.write_bytes(raw)
    print(f'{OUTPUT.name}: {len(raw)} bytes; sha256={hashlib.sha256(raw).hexdigest()}')
