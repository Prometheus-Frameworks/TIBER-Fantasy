import unittest
from modules.vorp_calculator import calculate_vorp

class TestVORPCalculator(unittest.TestCase):
    def test_rb_young(self):
        # RB: 250.0 - 168.0 = 82.0 (no age penalty at 26)
        self.assertEqual(calculate_vorp(250.0, "RB", 26), 82.0)

    def test_rb_older(self):
        # RB: 250.0 - 168.0 = 82.0, age penalty (30-28)*1.0 = 2.0, final = 80.0
        self.assertEqual(calculate_vorp(250.0, "RB", 30), 80.0)

    def test_wr_senior(self):
        # WR: 220.0 - 160.0 = 60.0, age penalty (32-28)*1.0 = 4.0, final = 56.0
        self.assertEqual(calculate_vorp(220.0, "WR", 32), 56.0)

    def test_qb_senior(self):
        # QB: 300.0 - 240.0 = 60.0, age penalty (35-30)*0.5 = 2.5, final = 57.5
        self.assertEqual(calculate_vorp(300.0, "QB", 35), 57.5)

    def test_te_baseline(self):
        # TE: 136.0 - 136.0 = 0.0 (at baseline, no age penalty applies to TE)
        self.assertEqual(calculate_vorp(136.0, "TE", 30), 0.0)

    def test_qb_no_penalty(self):
        # QB: 300.0 - 240.0 = 60.0 (no age penalty at 30)
        self.assertEqual(calculate_vorp(300.0, "QB", 30), 60.0)

    def test_wr_no_penalty(self):
        # WR: 200.0 - 160.0 = 40.0 (no age penalty at 28)
        self.assertEqual(calculate_vorp(200.0, "WR", 28), 40.0)

if __name__ == '__main__':
    unittest.main()