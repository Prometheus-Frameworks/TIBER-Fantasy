"""
Unit tests for VORP Calculator module
Dynasty-aware Value Over Replacement Player calculation testing
"""

import unittest
from modules.vorp_calculator import (
    calculate_vorp,
    calculate_vorp_with_age, 
    calculate_age_penalty, 
    get_replacement_baseline,
    calculate_player_vorp,
    get_vorp_tier,
    batch_assign_vorp,
    VORPCalculator
)


class TestVORPCalculator(unittest.TestCase):
    """Test suite for VORP calculation functions"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.calculator = VORPCalculator()
    
    def test_replacement_baselines(self):
        """Test position-specific replacement baselines"""
        self.assertEqual(get_replacement_baseline('QB'), 240.0)
        self.assertEqual(get_replacement_baseline('RB'), 168.0)
        self.assertEqual(get_replacement_baseline('WR'), 160.0)
        self.assertEqual(get_replacement_baseline('TE'), 136.0)
        self.assertEqual(get_replacement_baseline('INVALID'), 0.0)
    
    def test_age_penalties(self):
        """Test age penalty calculations"""
        # QB penalties (threshold 30, rate 0.5)
        self.assertEqual(calculate_age_penalty('QB', 30), 0.0)
        self.assertEqual(calculate_age_penalty('QB', 32), 1.0)
        self.assertEqual(calculate_age_penalty('QB', 35), 2.5)
        
        # RB penalties (threshold 28, rate 1.0)
        self.assertEqual(calculate_age_penalty('RB', 28), 0.0)
        self.assertEqual(calculate_age_penalty('RB', 30), 2.0)
        self.assertEqual(calculate_age_penalty('RB', 32), 4.0)
        
        # WR penalties (threshold 28, rate 1.0)
        self.assertEqual(calculate_age_penalty('WR', 28), 0.0)
        self.assertEqual(calculate_age_penalty('WR', 31), 3.0)
        
        # TE no penalties
        self.assertEqual(calculate_age_penalty('TE', 35), 0.0)
    
    def test_basic_vorp_calculation(self):
        """Test basic VORP calculations without age penalties"""
        # Test simplified VORP function
        self.assertEqual(calculate_vorp(200.0, 160.0), 40.0)
        self.assertEqual(calculate_vorp(168.0, 168.0), 0.0)
        self.assertEqual(calculate_vorp(300.0, 240.0), 60.0)
        
        # Test dynasty VORP with age
        self.assertEqual(calculate_vorp_with_age(168.0, 'RB', 25), 0.0)
        self.assertEqual(calculate_vorp_with_age(300.0, 'QB', 28), 60.0)
        self.assertEqual(calculate_vorp_with_age(200.0, 'WR', 26), 40.0)
        self.assertEqual(calculate_vorp_with_age(136.0, 'TE', 30), 0.0)
    
    def test_vorp_with_age_penalties(self):
        """Test VORP calculations with age penalties applied"""
        # Aging RB: 250 points, age 30
        # 250 - 168 - (30-28)*1.0 = 80.0
        self.assertEqual(calculate_vorp_with_age(250.0, 'RB', 30), 80.0)
        
        # Senior QB: 300 points, age 35
        # 300 - 240 - (35-30)*0.5 = 57.5
        self.assertEqual(calculate_vorp_with_age(300.0, 'QB', 35), 57.5)
        
        # Veteran WR: 220 points, age 32
        # 220 - 160 - (32-28)*1.0 = 56.0
        self.assertEqual(calculate_vorp_with_age(220.0, 'WR', 32), 56.0)
        
        # Old TE (no penalty): 180 points, age 35
        # 180 - 136 - 0 = 44.0
        self.assertEqual(calculate_vorp_with_age(180.0, 'TE', 35), 44.0)
    
    def test_negative_vorp_scores(self):
        """Test below-replacement player calculations"""
        # Bad young QB
        self.assertEqual(calculate_vorp_with_age(200.0, 'QB', 25), -40.0)
        
        # Aging backup RB
        self.assertEqual(calculate_vorp_with_age(150.0, 'RB', 31), -21.0)  # 150-168-3 = -21
    
    def test_vorp_tiers(self):
        """Test VORP tier classifications"""
        self.assertEqual(get_vorp_tier(85), 'Elite')
        self.assertEqual(get_vorp_tier(70), 'Premium')
        self.assertEqual(get_vorp_tier(50), 'Solid')  
        self.assertEqual(get_vorp_tier(30), 'Depth')
        self.assertEqual(get_vorp_tier(10), 'Replacement')
        self.assertEqual(get_vorp_tier(-5), 'Below Replacement')
    
    def test_player_vorp_analysis(self):
        """Test comprehensive player VORP analysis"""
        player = {
            'projected_points': 250.0,
            'position': 'RB',
            'age': 30,
            'name': 'Test Player'
        }
        
        result = calculate_player_vorp(player)
        
        self.assertEqual(result['vorp'], 80.0)
        self.assertEqual(result['projected_points'], 250.0)
        self.assertEqual(result['replacement_baseline'], 168.0)
        self.assertEqual(result['age_penalty'], 2.0)
        self.assertEqual(result['raw_vorp'], 82.0)
        self.assertEqual(result['position'], 'RB')
        self.assertEqual(result['age'], 30)
        self.assertEqual(result['tier'], 'Elite')
    
    def test_calculator_class_methods(self):
        """Test VORPCalculator class functionality"""
        # Test basic calculation
        vorp = self.calculator.calculate(200.0, 'WR', 30)
        self.assertEqual(vorp, 38.0)  # 200-160-2 = 38
        
        # Test player analysis
        player = {'projected_points': 280.0, 'position': 'QB', 'age': 32}
        analysis = self.calculator.analyze_player(player)
        self.assertEqual(analysis['vorp'], 39.0)  # 280-240-1 = 39
        
        # Test custom baseline
        self.calculator.set_custom_baseline('QB', 250.0)
        vorp = self.calculator.calculate(280.0, 'QB', 32)
        self.assertEqual(vorp, 29.0)  # 280-250-1 = 29
    
    def test_player_comparison(self):
        """Test multiple player comparison functionality"""
        players = [
            {'name': 'Player A', 'projected_points': 250.0, 'position': 'RB', 'age': 25},
            {'name': 'Player B', 'projected_points': 240.0, 'position': 'RB', 'age': 30},
            {'name': 'Player C', 'projected_points': 260.0, 'position': 'RB', 'age': 32}
        ]
        
        rankings = self.calculator.compare_players(players)
        
        # Should be sorted by VORP: C(88.0), A(82.0), B(70.0)
        # C: 260 - 168 - 4 = 88.0 (age 32, penalty = 4)
        # A: 250 - 168 - 0 = 82.0 (age 25, no penalty)  
        # B: 240 - 168 - 2 = 70.0 (age 30, penalty = 2)
        self.assertEqual(rankings[0]['name'], 'Player C')
        self.assertEqual(rankings[0]['vorp'], 88.0)
        self.assertEqual(rankings[1]['name'], 'Player A') 
        self.assertEqual(rankings[1]['vorp'], 82.0)
        self.assertEqual(rankings[2]['name'], 'Player B')
        self.assertEqual(rankings[2]['vorp'], 70.0)
    
    def test_position_filtering(self):
        """Test position-specific rankings"""
        players = [
            {'name': 'QB1', 'projected_points': 280.0, 'position': 'QB', 'age': 28},
            {'name': 'RB1', 'projected_points': 200.0, 'position': 'RB', 'age': 26}, 
            {'name': 'QB2', 'projected_points': 260.0, 'position': 'QB', 'age': 33}
        ]
        
        qb_rankings = self.calculator.get_position_rankings(players, 'QB')
        
        self.assertEqual(len(qb_rankings), 2)
        self.assertEqual(qb_rankings[0]['name'], 'QB1')  # 280-240 = 40
        self.assertEqual(qb_rankings[1]['name'], 'QB2')  # 260-240-1.5 = 18.5
    
    def test_batch_assign_vorp(self):
        """Test batch VORP assignment functionality"""
        players = [
            {'name': 'QB1', 'position': 'QB', 'projected_points': 280.0},
            {'name': 'RB1', 'position': 'RB', 'projected_points': 200.0},
            {'name': 'WR1', 'position': 'WR', 'projected_points': 180.0}
        ]
        
        baseline_dict = {'QB': 240.0, 'RB': 168.0, 'WR': 160.0}
        
        result = batch_assign_vorp(players, baseline_dict)
        
        self.assertEqual(result[0]['vorp'], 40.0)  # 280-240
        self.assertEqual(result[1]['vorp'], 32.0)  # 200-168
        self.assertEqual(result[2]['vorp'], 20.0)  # 180-160
    
    def test_calculator_batch_process(self):
        """Test VORPCalculator batch processing"""
        players = [
            {'name': 'Player A', 'position': 'QB', 'projected_points': 300.0},
            {'name': 'Player B', 'position': 'RB', 'projected_points': 220.0}
        ]
        
        result = self.calculator.batch_process(players)
        
        self.assertEqual(result[0]['vorp'], 60.0)  # 300-240
        self.assertEqual(result[1]['vorp'], 52.0)  # 220-168


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)