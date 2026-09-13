"""Offline, pinned consumer transform. No downloads, identity inference or forecasts."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess

BASELINE_COMMIT = '8b762650f4b933b6ce717c551993dcaaf92e1008'
DATA_COMMIT = 'f12234d909adc82e79ca463e76b994c8dd24bdb9'
PROMOTION_BASE_COMMIT = 'c0a7d1e98161c23f64f67c075f81eb71d6ba693a'
PROMOTION_PATH = 'exports/promoted/draft_review/team_roster_identity_promotion_v1.json'
PROMOTION_SHA256 = '215d2b47edb204a138d30725b4e2e3974993f105271667d665c651b825408c85'
ROSTER_BASE_COMMIT = 'e65791d3169c0234b80bdb4bfb00c3ed848d64dd'
ROSTER_BASE_IDENTITY_SHA = '02e360f58837f620e26b071992f90c444486388e692e39c5dcffc23f63e8a0c9'
ROSTER_RECEIPT_PATH = 'exports/promoted/draft_review/team_roster_identity_admission_v1.json'
ROSTER_ACCEPTANCE = {'source': 'operator_conversation',
 'date': '2026-09-13',
 'operator_message': 'Okay sounds good',
 'public_receipt_url': None,
 'context': 'Acceptance followed independent proposal review and an explanation that transferred '
            'players retain their historical weekly teams.',
 'scope': 'nineteen reviewed historical identity edges; Data branch materialization and matching '
          'Fantasy consumer integration preparation; no merge or production release'}
ROSTER_REVIEW = {'source': 'independent_agent_review_in_operator_conversation',
 'review_date': '2026-09-13',
 'proposal_sha256': 'a00fbfe876db14372a170c3a579971537c5074b1632f2688e3b2e09c6a775e8b',
 'review_sha256': '471237237f5be9fce7185f12464084bfd8dc9f25e3d85e91f648b30d7b50b996',
 'result': 'no_material_findings_on_nineteen_edge_proposal',
 'public_receipt_url': None,
 'implementation_review': 'pending_separate_review'}
ROSTER_EDGES = {'10444': ('00-0038979', 'name_exact', 'medium'),
 '10218': ('00-0038618', 'name_exact', 'medium'),
 '8127': ('00-0038046', 'name_exact', 'medium'),
 '11571': ('00-0039798', 'name_exact', 'medium'),
 '11575': ('00-0039875', 'name_exact', 'medium'),
 '5022': ('00-0034351', 'gsis_direct', 'high'),
 '5892': ('00-0035685', 'gsis_direct', 'high'),
 '5927': ('00-0035659', 'gsis_direct', 'high'),
 '6768': ('00-0036212', 'espn_bridge', 'high'),
 '6819': ('00-0036252', 'espn_bridge', 'high'),
 '7525': ('00-0036912', 'name_exact', 'medium'),
 '8142': ('00-0037664', 'name_exact', 'medium'),
 '8146': ('00-0037740', 'name_exact', 'medium'),
 '8161': ('00-0038128', 'name_exact', 'medium'),
 '9508': ('00-0039032', 'name_exact', 'medium'),
 '10213': ('00-0038563', 'name_exact', 'medium'),
 '11834': ('00-0039424', 'name_exact', 'medium'),
 '12048': ('00-0039299', 'name_exact', 'medium'),
 '12507': ('00-0040666', 'name_exact', 'medium')}
IDENTITY_PATH = 'exports/promoted/identity_crosswalk/tiber_identity_crosswalk_v2.json'
BASELINE_IDENTITY_SHA = 'c0e5c32a20b0397ff22e994a0fd48ec16907b5909f0880e0ebd3c7c89f0f9809'
TEAM_RECEIPT_PATH = 'exports/promoted/draft_review/team_identity_admission_v1.json'
CONSUMER_AUTHORIZATION = 'https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/372#issuecomment-5627769635'
TEAM_ACCEPTANCE = 'https://github.com/Prometheus-Frameworks/TIBER-Data/pull/268#issuecomment-5627117154'
TEAM_EDGES = {'9487': '00-0038606', '8112': '00-0037238', '10219': '00-0038611'}
PINS = {
 PROMOTION_PATH: PROMOTION_SHA256,
 'exports/promoted/draft_review/evidence_admission_v1.json': '603e52409c5d07820bc58c5c0b7d6df91e4eb7cdc31326633d1c24e35c34811c',
 IDENTITY_PATH: '72521b56b1edd92fbb1feac974ab2608a599004f378974192e885278a4007011',
 ROSTER_RECEIPT_PATH: 'cc61d1e236138e1c1e6685fb444c3db81da1188d7cfcc895b278164916e9be4f',
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
    raw = subprocess.check_output(['git', '-C', str(repo), 'show', f'{commit}:{path}'],
                                  env={**os.environ, 'GIT_NO_LAZY_FETCH': '1'})
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

def validate_roster_admissions(admission, roster, identities, prior):
    require(roster['schema_version'] == 'team_roster_identity_admission_v1'
            and roster['status'] == 'accepted_for_branch_and_consumer_preparation'
            and roster['scope'] == 'nineteen_historical_identity_edges_only'
            and roster['operator_acceptance'] == ROSTER_ACCEPTANCE
            and roster['proposal_review'] == ROSTER_REVIEW
            and roster['baseline_commit'] == ROSTER_BASE_COMMIT,
            'Unexpected roster admission authority')
    require(roster['consumer_bundle_regeneration_authorized'] is True
            and all(roster[k] is False for k in ['merge_authorized', 'production_deployment_authorized', 'production_release_authorized']),
            'Unexpected roster admission permissions')
    require(roster['consumer_scope'] == admission['consumer_scope']
            and roster['excluded_player_ids'] == ['13301'], 'Roster historical scope changed')
    old, current, additions = [identity_map(x) for x in [prior['records'], identities['records'], roster['identity_records']]]
    require(len(old) == 75 and len(current) == 94 and len(additions) == 19,
            'Unexpected roster identity slice size')
    require(set(additions) == set(ROSTER_EDGES) and set(current) - set(old) == set(ROSTER_EDGES),
            'Unexpected roster identity delta')
    require(all(current.get(k) == v for k, v in old.items()), 'Prior identity changed or removed')
    for pid, expected in ROSTER_EDGES.items():
        row = additions[pid]
        require(current[pid] == row and tuple(row[k] for k in ['tiber_player_id', 'match_method', 'confidence']) == expected,
                'Roster identity differs from exact admitted edge')
    return list(current.values())


def validate_roster_promotion(promotion, roster):
    # Exact byte admission is checked by read_pinned. Independently bind its
    # authority to the unchanged preparation cohort and descriptive scope.
    require(promotion['schema_version'] == 'team_roster_identity_promotion_v1'
            and promotion['status'] == 'accepted_for_historical_consumer_use'
            and promotion['scope'] == 'nineteen_historical_identity_edges_only'
            and promotion['baseline_commit'] == PROMOTION_BASE_COMMIT,
            'Unexpected historical promotion authority')
    require(promotion['historical_consumer_use_authorized'] is True
            and promotion['consumer_activation_changes_authorized'] is True
            and all(promotion[k] is False for k in ['merge_authorized', 'deployment_authorized', 'production_release_authorized']),
            'Unexpected historical promotion permissions')
    require(promotion['preparation_receipt'] == {'path': ROSTER_RECEIPT_PATH, 'sha256': PINS[ROSTER_RECEIPT_PATH]}
            and promotion['player_ids'] == list(ROSTER_EDGES)
            and promotion['excluded_player_ids'] == ['13301'], 'Promotion cohort or preparation pin differs')
    for key in ['identity_records', 'consumer_scope', 'historical_validation', 'limitations', 'exclusion_context']:
        require(json.dumps(promotion[key], sort_keys=True, allow_nan=False) == json.dumps(roster[key], sort_keys=True, allow_nan=False),
                f'Promotion changed prepared evidence: {key}')
    acceptance = promotion['operator_acceptance']
    require(acceptance == {'source': 'operator_conversation', 'date': '2026-09-13',
        'operator_message': 'Proceed with the nineteen-player historical promotion receipt and matching Team consumer activation changes, tests, paired PRs and independent review. Preserve all source limitations and exclude Antonio Williams. Stop before merging or deploying the activation changes.',
        'public_receipt_url': None}, 'Unexpected promotion acceptance')
    expected_sources = {s['path']: s['sha256'] for s in roster['sources']}
    expected_sources[IDENTITY_PATH] = PINS[IDENTITY_PATH]
    expected_sources[ROSTER_RECEIPT_PATH] = PINS[ROSTER_RECEIPT_PATH]
    require(len(promotion['sources']) == len(expected_sources)
            and {s['path']: s['sha256'] for s in promotion['sources']} == expected_sources
            and all(s['commit'] == PROMOTION_BASE_COMMIT for s in promotion['sources']),
            'Promotion source pins differ')


def build(repo):
    loaded = {path: json.loads(read_pinned(repo, DATA_COMMIT, path, expected))
              for path, expected in PINS.items()}
    admission = loaded['exports/promoted/draft_review/evidence_admission_v1.json']
    identities, team = loaded[IDENTITY_PATH], loaded[TEAM_RECEIPT_PATH]
    usage = loaded['data/processed/evidence/player_weekly_usage_2025.source_backed.json']
    outcomes = loaded['data/processed/evidence/player_weekly_ppr_outcomes_2025.source_backed.json']
    baseline = json.loads(read_pinned(repo, BASELINE_COMMIT, IDENTITY_PATH, BASELINE_IDENTITY_SHA))
    prior = json.loads(read_pinned(repo, ROSTER_BASE_COMMIT, IDENTITY_PATH, ROSTER_BASE_IDENTITY_SHA))
    validate_admissions(admission, team, prior, baseline)
    roster = loaded[ROSTER_RECEIPT_PATH]
    selected = validate_roster_admissions(admission, roster, identities, prior)
    promotion = loaded[PROMOTION_PATH]
    validate_roster_promotion(promotion, roster)
    for source in promotion['sources']:
        read_pinned(repo, PROMOTION_BASE_COMMIT, source['path'], source['sha256'])
    for source in roster['sources']:
        require(source['commit'] == ROSTER_BASE_COMMIT, 'Unexpected roster admission source commit')
        read_pinned(repo, ROSTER_BASE_COMMIT, source['path'], source['sha256'])
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
            'team_roster_identity_promotion': {
                'path': PROMOTION_PATH, 'sha256': PROMOTION_SHA256, 'receipt': promotion,
            },
            'team_roster_identity_admission': {
                'path': ROSTER_RECEIPT_PATH, 'sha256': PINS[ROSTER_RECEIPT_PATH],
                'receipt_stage': roster['status'], 'player_ids': list(ROSTER_EDGES),
                'operator_acceptance': roster['operator_acceptance'], 'proposal_review': roster['proposal_review'],
                'baseline_producer_commit': ROSTER_BASE_COMMIT,
                'baseline_identity_sha256': ROSTER_BASE_IDENTITY_SHA,
                'limitations': roster['limitations'],
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
