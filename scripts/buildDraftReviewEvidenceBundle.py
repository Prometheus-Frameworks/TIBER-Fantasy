"""Offline, pinned consumer transform. No downloads, identity inference or forecasts."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess

BASELINE_COMMIT = '8b762650f4b933b6ce717c551993dcaaf92e1008'
DATA_COMMIT = '488220fa05c834aad3a4e2bea839a1843131053a'
IDENTITY_PATH = 'exports/promoted/identity_crosswalk/tiber_identity_crosswalk_v2.json'
BASELINE_IDENTITY_SHA = 'c0e5c32a20b0397ff22e994a0fd48ec16907b5909f0880e0ebd3c7c89f0f9809'
TEAM_RECEIPT_PATH = 'exports/promoted/draft_review/team_identity_admission_v1.json'
CONSUMER_AUTHORIZATION = 'https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/372#issuecomment-5627769635'
TEAM_ACCEPTANCE = 'https://github.com/Prometheus-Frameworks/TIBER-Data/pull/268#issuecomment-5627117154'
TEAM_EDGES = {'9487': '00-0038606', '8112': '00-0037238', '10219': '00-0038611'}
PINS = {
 'exports/promoted/draft_review/evidence_admission_v1.json': '603e52409c5d07820bc58c5c0b7d6df91e4eb7cdc31326633d1c24e35c34811c',
 IDENTITY_PATH: '02e360f58837f620e26b071992f90c444486388e692e39c5dcffc23f63e8a0c9',
 'data/processed/evidence/player_weekly_usage_2025.source_backed.json': '30a8e17370270e2fa5d055c7a771f19af2fe7bd89282cd2373f7704a492412cb',
 'data/processed/evidence/player_weekly_ppr_outcomes_2025.source_backed.json': 'f241112115c9a625abead3410db89db6b4a8b603ce1dd663a45ff0697563e3a2',
 TEAM_RECEIPT_PATH: '4ed7a6e7d0310c0f3b3e3c70a53f7d7ec0fb0c22dbd931702ea5efc4399f84ef',
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

def require(condition, message):
    # Explicit exceptions keep admission gates active under python -O.
    if not condition:
        raise ValueError(message)

def read_pinned(repo, commit, path, expected):
    raw = subprocess.check_output(['git', '-C', str(repo), 'show', f'{commit}:{path}'])
    require(hashlib.sha256(raw).hexdigest() == expected, f'Pinned source mismatch: {path}')
    return raw

def identity_map(records):
    require(all(r.get('provider') == 'sleeper' for r in records), 'Unexpected identity provider')
    result = {r['provider_player_id']: r for r in records}
    require(len(result) == len(records), 'Duplicate provider identity')
    require(len({r['tiber_player_id'] for r in records}) == len(records), 'Duplicate GSIS identity')
    return result

def validate_admissions(admission, team, identities, baseline):
    require(admission['status'] == 'accepted', 'Prior admission not accepted')
    for receipt in (admission, team):
        require(receipt['merge_authorized'] is False and receipt['production_deployment_authorized'] is False,
                'Unexpected release authority')
    require(team['schema_version'] == 'team_identity_admission_v1'
            and team['status'] == 'accepted_for_branch_preparation'
            and team['scope'] == 'three_historical_identity_edges_only'
            and team['operator_acceptance'] == TEAM_ACCEPTANCE, 'Unexpected Team admission authority')
    # These are the earlier preparation-stage receipt's limits, not the later permission.
    require(team['consumer_bundle_regeneration_authorized'] is False
            and team['production_release_authorized'] is False, 'Unexpected preparation-stage permissions')
    scope = admission['consumer_scope']
    require(team['consumer_scope'] == scope, 'Team consumer scope differs from accepted history')
    require(scope['season'] == 2025 and scope['weeks'] == [1, 18]
            and scope['outcome_fields'] == COUNTS and scope['usage_fields'] == SHARES
            and scope['mode'] == 'retrospective_descriptive_only'
            and scope['exact_approved_identity_required'] is True
            and scope['forecast_allowed'] is False and scope['refresh_allowed'] is False,
            'Unsupported historical scope')
    old = identity_map(baseline['records'])
    current = identity_map(identities['records'])
    additions = identity_map(team['identity_records'])
    require(len(old) == 72 and len(current) == 75, 'Unexpected identity slice size')
    require(set(additions) == set(TEAM_EDGES) and set(current) - set(old) == set(TEAM_EDGES),
            'Unexpected identity delta')
    require(all(current.get(k) == v for k, v in old.items()), 'Prior identity changed or removed')
    for pid, gsis in TEAM_EDGES.items():
        row = additions[pid]
        require(current[pid] == row and row['tiber_player_id'] == gsis
                and row['confidence'] == 'medium' and row['match_method'] == 'name_exact',
                'Team identity differs from exact admitted edge')
    return list(current.values())

def build(repo):
    loaded = {path: json.loads(read_pinned(repo, DATA_COMMIT, path, expected))
              for path, expected in PINS.items()}
    admission = loaded['exports/promoted/draft_review/evidence_admission_v1.json']
    identities, team = loaded[IDENTITY_PATH], loaded[TEAM_RECEIPT_PATH]
    usage = loaded['data/processed/evidence/player_weekly_usage_2025.source_backed.json']
    outcomes = loaded['data/processed/evidence/player_weekly_ppr_outcomes_2025.source_backed.json']
    baseline = json.loads(read_pinned(repo, BASELINE_COMMIT, IDENTITY_PATH, BASELINE_IDENTITY_SHA))
    selected = validate_admissions(admission, team, identities, baseline)
    # The Team receipt binds the old crosswalk as its audit baseline. Never mistake that
    # source pin for the newly materialized crosswalk pin above.
    for source in team['sources']:
        commit = BASELINE_COMMIT if source['path'] == IDENTITY_PATH else DATA_COMMIT
        read_pinned(repo, commit, source['path'], source['sha256'])
    read_pinned(repo, team['proposal_commit'], team['proposal_path'], team['proposal_sha256'])
    scope = admission['consumer_scope']
    oi, ui = index(outcomes['records']), index(usage['records'])
    return {
        'schema_version': 'tiber_draft_review_historical_v1',
        'window': {'season': 2025, 'week_start': 1, 'week_end': 18, 'period_basis': scope['period_basis']},
        'provenance': {
            'producer_repo': 'Prometheus-Frameworks/TIBER-Data', 'producer_commit': DATA_COMMIT,
            'sources': [{'path': p, 'sha256': h} for p, h in PINS.items()],
            'operator_acceptance': admission['operator_acceptance'],
            'team_identity_admission': {
                'path': TEAM_RECEIPT_PATH, 'sha256': PINS[TEAM_RECEIPT_PATH],
                'operator_acceptance': team['operator_acceptance'],
                'player_ids': list(TEAM_EDGES),
                'receipt_stage': team['status'],
                'consumer_authorization': CONSUMER_AUTHORIZATION,
                'consumer_authorization_scope': 'three historical identities; consumer integration, regeneration, tests, independent review and isolated preview only; no merge or production release',
                'baseline_producer_commit': BASELINE_COMMIT,
                'baseline_identity_sha256': BASELINE_IDENTITY_SHA,
                'limitations': team['limitations'],
            },
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
        require(OUTPUT.read_bytes() == raw, 'Committed consumer bundle differs from deterministic replay')
    else:
        OUTPUT.write_bytes(raw)
    print(f'{OUTPUT.name}: {len(raw)} bytes; sha256={hashlib.sha256(raw).hexdigest()}')
