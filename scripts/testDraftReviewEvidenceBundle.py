"""Focused semantic tests for the offline consumer transform."""
import unittest
from copy import deepcopy
from unittest.mock import patch
import hashlib
from buildDraftReviewEvidenceBundle import index, metric, profile, validate_admissions, read_pinned, COUNTS, SHARES, TEAM_EDGES, TEAM_ACCEPTANCE
from buildDraftReviewEvidenceBundle import validate_roster_admissions, ROSTER_EDGES, ROSTER_ACCEPTANCE, ROSTER_REVIEW, ROSTER_BASE_COMMIT

class BundleTests(unittest.TestCase):
    def test_missing_values_do_not_become_zero_or_complete_totals(self):
        self.assertEqual(metric([5, None]), {'total': None, 'mean': 5, 'nonnull_weeks': 1, 'recorded_weeks': 2})
        self.assertIsNone(metric([None])['mean'])
        self.assertEqual(metric([0])['total'], 0)
    def test_share_range_preserved_and_not_summed(self):
        self.assertEqual(metric([-0.5, 1.5], True), {'total': None, 'mean': 0.5, 'nonnull_weeks': 2, 'recorded_weeks': 2})
    def test_window_and_duplicate_keys(self):
        rows = [{'player_id': 'gsis', 'season': 2025, 'week': w} for w in [1, 18, 19]]
        self.assertEqual(len(index(rows)), 2)
        with self.assertRaises(ValueError): index(rows + [rows[0]])
    def test_conflict_blocks_joined_share_but_preserves_outcome(self):
        identity = {'tiber_player_id': 'gsis', 'provider_player_id': '123', 'confidence': 'medium', 'match_method': 'name_exact'}
        row = {'season': 2025, 'week': 1, 'player_id': 'gsis', 'team': 'A', 'opponent': 'B', 'position': 'RB', 'targets': 3}
        other = {**row, 'position': 'WR', 'target_share': 0.4}
        result = profile(identity, index([row]), index([other]))
        self.assertEqual(result['derived']['targets']['total'], 3)
        self.assertIsNone(result['derived']['target_share']['mean'])
        self.assertEqual(result['observed']['usage_conflict_weeks'], [1])
        missing = profile(identity, index([row]), {})
        self.assertEqual(missing['observed']['usage_missing_weeks'], [1])

class AdmissionTests(unittest.TestCase):
    def setUp(self):
        self.baseline = {'records': [dict(provider='sleeper', provider_player_id=str(100000 + i),
                                         tiber_player_id=f'baseline-{i}') for i in range(72)]}
        rows = [dict(provider='sleeper', provider_player_id=pid, tiber_player_id=gsis,
                     confidence='medium', match_method='name_exact') for pid, gsis in TEAM_EDGES.items()]
        scope = dict(season=2025, weeks=[1, 18], outcome_fields=COUNTS, usage_fields=SHARES,
                     mode='retrospective_descriptive_only', exact_approved_identity_required=True,
                     forecast_allowed=False, refresh_allowed=False)
        self.admission = dict(status='accepted', merge_authorized=False,
                              production_deployment_authorized=False, consumer_scope=scope)
        self.team = dict(schema_version='team_identity_admission_v1', status='accepted_for_branch_preparation',
                         scope='three_historical_identity_edges_only', operator_acceptance=TEAM_ACCEPTANCE,
                         merge_authorized=False, production_deployment_authorized=False,
                         production_release_authorized=False, consumer_bundle_regeneration_authorized=False,
                         consumer_scope=deepcopy(scope), identity_records=rows)
        self.current = {'records': deepcopy(self.baseline['records'] + rows)}

    def validate(self):
        return validate_admissions(self.admission, self.team, self.current, self.baseline)

    def test_exact_additive_slice_and_prior_rows(self):
        result = self.validate()
        self.assertEqual(result[:72], self.baseline['records'])
        self.assertEqual(len(result), 75)

    def test_missing_or_changed_authority_rejected(self):
        for key, value in [('operator_acceptance', 'unrelated'), ('status', 'proposed'),
                           ('consumer_bundle_regeneration_authorized', True), ('merge_authorized', True)]:
            with self.subTest(key=key):
                prior = self.team[key]; self.team[key] = value
                with self.assertRaises(ValueError): self.validate()
                self.team[key] = prior
        del self.team['operator_acceptance']
        with self.assertRaises(KeyError): self.validate()

    def test_broader_consumer_scope_rejected(self):
        self.team['consumer_scope']['weeks'] = [1, 19]
        with self.assertRaises(ValueError): self.validate()
        self.admission['consumer_scope']['weeks'] = [1, 19]
        with self.assertRaises(ValueError): self.validate()

    def test_changed_or_removed_prior_identity_rejected(self):
        self.current['records'][0]['tiber_player_id'] = 'changed'
        with self.assertRaises(ValueError): self.validate()
        self.current['records'].pop(0)
        with self.assertRaises(ValueError): self.validate()

    def test_wrong_edge_or_confidence_even_when_receipt_agrees_rejected(self):
        for key, value in [('confidence', 'high'), ('match_method', 'gsis_direct'),
                           ('tiber_player_id', 'different-gsis')]:
            with self.subTest(key=key):
                old = self.team['identity_records'][0][key]
                self.team['identity_records'][0][key] = value
                self.current['records'][72][key] = value
                with self.assertRaises(ValueError): self.validate()
                self.team['identity_records'][0][key] = old
                self.current['records'][72][key] = old

    def test_extra_missing_duplicate_and_wrong_provider_rejected(self):
        original = deepcopy(self.current)
        for operation in ('extra', 'missing', 'duplicate', 'provider'):
            with self.subTest(operation=operation):
                self.current = deepcopy(original)
                if operation == 'extra': self.current['records'].append(dict(provider='sleeper', provider_player_id='444', tiber_player_id='extra'))
                if operation == 'missing': self.current['records'].pop()
                if operation == 'duplicate': self.current['records'][-1] = deepcopy(self.current['records'][0])
                if operation == 'provider': self.current['records'][-1]['provider'] = 'other'
                with self.assertRaises(ValueError): self.validate()

    def test_source_byte_pin_rejects_tampering(self):
        raw = b'{"records":[]}'
        with patch('buildDraftReviewEvidenceBundle.subprocess.check_output', return_value=raw):
            self.assertEqual(read_pinned('/unused', 'commit', 'file', hashlib.sha256(raw).hexdigest()), raw)
            with self.assertRaises(ValueError): read_pinned('/unused', 'commit', 'file', '0' * 64)

class RosterAdmissionTests(unittest.TestCase):
    def setUp(self):
        self.prior = {'records': [dict(provider='sleeper', provider_player_id=str(200000+i),
                                       tiber_player_id=f'baseline-{i}') for i in range(75)]}
        rows = [dict(provider='sleeper', provider_player_id=p, tiber_player_id=g,
                     match_method=m, confidence=c) for p, (g, m, c) in ROSTER_EDGES.items()]
        self.admission = {'consumer_scope': {'season': 2025, 'weeks': [1,18], 'forecast_allowed': False}}
        self.receipt = dict(schema_version='team_roster_identity_admission_v1',
            status='accepted_for_branch_and_consumer_preparation', scope='nineteen_historical_identity_edges_only',
            operator_acceptance=deepcopy(ROSTER_ACCEPTANCE), proposal_review=deepcopy(ROSTER_REVIEW),
            baseline_commit=ROSTER_BASE_COMMIT, consumer_bundle_regeneration_authorized=True,
            merge_authorized=False, production_deployment_authorized=False, production_release_authorized=False,
            consumer_scope=deepcopy(self.admission['consumer_scope']), excluded_player_ids=['13301'], identity_records=rows)
        self.current = {'records': deepcopy(self.prior['records']+rows)}

    def validate(self):
        return validate_roster_admissions(self.admission, self.receipt, self.current, self.prior)

    def test_exact_delta_and_preserved_prior(self):
        result = self.validate()
        self.assertEqual(result[:75], self.prior['records'])
        self.assertEqual(len(result), 94)

    def test_authority_scope_and_exclusion_mutations_fail(self):
        original = deepcopy(self.receipt)
        for field, value in [('status','proposed'), ('scope','all_candidates'), ('operator_acceptance',{}),
                ('proposal_review',{}), ('baseline_commit','wrong'), ('consumer_bundle_regeneration_authorized',False),
                ('merge_authorized',True), ('merge_authorized',0), ('production_release_authorized',True),
                ('consumer_scope',{}), ('excluded_player_ids',[])]:
            with self.subTest(field=field,value=value):
                self.receipt=deepcopy(original); self.receipt[field]=value
                with self.assertRaises(ValueError): self.validate()

    def test_extra_missing_duplicate_prior_change_fail(self):
        original = deepcopy(self.current)
        for operation in ['extra','missing','duplicate','prior']:
            with self.subTest(operation=operation):
                self.current=deepcopy(original)
                if operation=='extra': self.current['records'].append(dict(provider='sleeper',provider_player_id='13301',tiber_player_id='rookie'))
                if operation=='missing': self.current['records'].pop()
                if operation=='duplicate': self.current['records'][-1]=deepcopy(self.current['records'][-2])
                if operation=='prior': self.current['records'][0]['tiber_player_id']='changed'
                with self.assertRaises(ValueError): self.validate()

    def test_receipt_cannot_upgrade_name_confidence_or_rewrite_edge(self):
        for field,value in [('confidence','high'),('match_method','gsis_direct'),('tiber_player_id','changed')]:
            self.setUp()
            self.current['records'][75][field]=value
            self.receipt['identity_records'][0][field]=value
            with self.assertRaises(ValueError): self.validate()

class PromotionTests(unittest.TestCase):
    def setUp(self):
        import json
        from pathlib import Path
        bundle = json.loads((Path(__file__).resolve().parents[1] / 'server/modules/draftReview/artifacts/historical2025.json').read_text())
        self.promotion = bundle['provenance']['team_roster_identity_promotion']['receipt']
        # Preparation evidence is preserved verbatim by the new receipt.
        self.roster = {k: deepcopy(self.promotion[k]) for k in [
            'identity_records', 'consumer_scope', 'historical_validation', 'limitations', 'exclusion_context']}
        from buildDraftReviewEvidenceBundle import IDENTITY_PATH, ROSTER_BASE_IDENTITY_SHA, ROSTER_RECEIPT_PATH
        self.roster['sources'] = [{**s, 'sha256': ROSTER_BASE_IDENTITY_SHA if s['path'] == IDENTITY_PATH else s['sha256']}
                                  for s in self.promotion['sources'] if s['path'] != ROSTER_RECEIPT_PATH]

    def test_promotion_matches_original_scope(self):
        from buildDraftReviewEvidenceBundle import validate_roster_promotion
        validate_roster_promotion(self.promotion, self.roster)

    def test_promotion_mutations_fail_closed(self):
        from buildDraftReviewEvidenceBundle import validate_roster_promotion
        for change in ['missing', 'cohort', 'exclusion', 'scope', 'confidence', 'team', 'acceptance', 'source', 'duplicate', 'grant', 'release', 'numeric_false', 'baseline']:
            with self.subTest(change=change):
                r = deepcopy(self.promotion)
                if change == 'missing': r = None
                if change == 'cohort': r['player_ids'].append('13301')
                if change == 'exclusion': r['excluded_player_ids'] = []
                if change == 'scope': r['consumer_scope']['forecast_allowed'] = True
                if change == 'confidence': r['identity_records'][0]['confidence'] = 'high'
                if change == 'team': r['historical_validation'][0]['historical_teams'] = ['NO']
                if change == 'acceptance': r['operator_acceptance']['operator_message'] = 'Okay sounds good'
                if change == 'source': r['sources'][0]['sha256'] = '0' * 64
                if change == 'duplicate': r['sources'].append(deepcopy(r['sources'][0]))
                if change == 'grant': r['historical_consumer_use_authorized'] = False
                if change == 'release': r['deployment_authorized'] = True
                if change == 'numeric_false': r['merge_authorized'] = 0
                if change == 'baseline': r['baseline_commit'] = '0' * 40
                with self.assertRaises((ValueError, TypeError, KeyError)):
                    validate_roster_promotion(r, self.roster)

if __name__ == '__main__': unittest.main()
