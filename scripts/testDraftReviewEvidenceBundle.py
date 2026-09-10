"""Focused semantic tests for the offline consumer transform."""
import unittest
from buildDraftReviewEvidenceBundle import index, metric, profile

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

if __name__ == '__main__': unittest.main()
