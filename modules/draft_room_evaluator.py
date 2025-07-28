#!/usr/bin/env python3
"""
Draft Room Evaluator Module
Enables automatic evaluation of rookies in startup or rookie drafts.
Highlights picks above or below consensus based on star rating and dynasty tier differentials.
"""

from typing import Dict, List, Any, Optional, Tuple
from modules.rookie_pipeline import get_rookie_pipeline
from modules.rookie_database import RookiePlayer

class DraftRoomEvaluator:
    """
    Evaluates draft picks in real-time, comparing actual selections
    to consensus rookie rankings and highlighting value opportunities.
    """
    
    def __init__(self):
        self.pipeline = get_rookie_pipeline()
        self.consensus_rankings = {}
        self.draft_grades = {
            'A+': {'min': 90, 'color': '#00FF00', 'description': 'Exceptional Value'},
            'A': {'min': 80, 'color': '#32CD32', 'description': 'Great Value'},
            'B+': {'min': 70, 'color': '#90EE90', 'description': 'Good Value'},
            'B': {'min': 60, 'color': '#FFFF00', 'description': 'Fair Value'},
            'C+': {'min': 50, 'color': '#FFA500', 'description': 'Slight Reach'},
            'C': {'min': 40, 'color': '#FF6347', 'description': 'Reach'},
            'D': {'min': 0, 'color': '#FF0000', 'description': 'Major Reach'}
        }
        self._build_consensus_rankings()
    
    def _build_consensus_rankings(self):
        """Build consensus rankings for all available rookie years"""
        available_years = self.pipeline.get_all_available_years()
        
        for year in available_years:
            rookies = self.pipeline.get_rookies_for_rankings(year=year)
            
            # Sort by tier weight (consensus ranking)
            rookies.sort(key=lambda x: x['tier_weight'], reverse=True)
            
            # Assign consensus ranks
            for i, rookie in enumerate(rookies, 1):
                rookie['consensus_rank'] = i
            
            self.consensus_rankings[year] = rookies
    
    def evaluate_pick(self, player_name: str, actual_pick: int, 
                     draft_type: str = 'startup', year: str = None) -> Dict[str, Any]:
        """
        Evaluate a single draft pick against consensus.
        
        Args:
            player_name: Name of drafted player
            actual_pick: Pick number where player was selected
            draft_type: 'startup' or 'rookie_only'
            year: Rookie year to evaluate against
        
        Returns:
            Dictionary with evaluation results
        """
        if year is None:
            year = self.pipeline.current_year
        
        # Find player in consensus rankings
        year_rookies = self.consensus_rankings.get(year, [])
        player_data = None
        
        for rookie in year_rookies:
            if rookie['name'].lower() == player_name.lower():
                player_data = rookie
                break
        
        if not player_data:
            return {
                'found': False,
                'error': f'Player {player_name} not found in {year} rookie class'
            }
        
        # Calculate expected pick range
        consensus_rank = player_data['consensus_rank']
        expected_pick = self._calculate_expected_pick(consensus_rank, draft_type)
        
        # Calculate value differential
        pick_differential = expected_pick - actual_pick
        value_score = self._calculate_value_score(pick_differential, player_data)
        
        # Assign grade
        grade_info = self._assign_grade(value_score)
        
        evaluation = {
            'found': True,
            'player_name': player_data['name'],
            'position': player_data['position'],
            'star_rating': player_data['star_rating'],
            'dynasty_tier': player_data['dynasty_tier'],
            'consensus_rank': consensus_rank,
            'actual_pick': actual_pick,
            'expected_pick': expected_pick,
            'pick_differential': pick_differential,
            'value_score': value_score,
            'grade': grade_info['grade'],
            'grade_color': grade_info['color'],
            'grade_description': grade_info['description'],
            'evaluation_notes': self._generate_evaluation_notes(player_data, pick_differential),
            'rookie_flag': True,
            'year': year
        }
        
        return evaluation
    
    def _calculate_expected_pick(self, consensus_rank: int, draft_type: str) -> int:
        """Calculate expected pick number based on consensus rank and draft type"""
        if draft_type == 'rookie_only':
            # In rookie-only drafts, consensus rank = expected pick
            return consensus_rank
        elif draft_type == 'startup':
            # In startup drafts, rookies typically go later
            # Apply startup penalty based on tier
            if consensus_rank <= 3:  # Elite rookies
                return consensus_rank + 15  # Still early but after established stars
            elif consensus_rank <= 10:  # Strong rookies
                return consensus_rank + 25
            else:  # Other rookies
                return consensus_rank + 40
        
        return consensus_rank
    
    def _calculate_value_score(self, pick_differential: int, player_data: Dict) -> float:
        """
        Calculate value score (0-100) based on pick differential and player attributes.
        Positive differential = value, negative = reach
        """
        base_score = 50.0  # Neutral
        
        # Primary component: pick differential
        differential_score = pick_differential * 2  # 2 points per pick difference
        
        # Bonus for high-ceiling players taken early
        ceiling_bonus = 0
        if player_data['star_rating'] >= 4.5:
            ceiling_bonus = 10
        elif player_data['star_rating'] >= 4.0:
            ceiling_bonus = 5
        
        # Tier bonus
        tier_bonus = 0
        if player_data['dynasty_tier'] == 'Tier 1':
            tier_bonus = 15
        elif player_data['dynasty_tier'] == 'Tier 2':
            tier_bonus = 10
        elif player_data['dynasty_tier'] == 'Tier 3':
            tier_bonus = 5
        
        # Calculate final score
        value_score = base_score + differential_score + ceiling_bonus + tier_bonus
        
        # Cap at 0-100 range
        return max(0.0, min(100.0, value_score))
    
    def _assign_grade(self, value_score: float) -> Dict[str, str]:
        """Assign letter grade based on value score"""
        for grade, info in self.draft_grades.items():
            if value_score >= info['min']:
                return {
                    'grade': grade,
                    'color': info['color'],
                    'description': info['description']
                }
        
        return {
            'grade': 'F',
            'color': '#800080',
            'description': 'Extreme Reach'
        }
    
    def _generate_evaluation_notes(self, player_data: Dict, pick_differential: int) -> str:
        """Generate contextual evaluation notes"""
        name = player_data['name']
        position = player_data['position']
        star_rating = player_data['star_rating']
        
        if pick_differential > 20:
            return f"Excellent value on {name}. Elite {position} with {star_rating}⭐ rating taken well below consensus."
        elif pick_differential > 10:
            return f"Good value pick. {name} has strong upside at {position} with solid {star_rating}⭐ rating."
        elif pick_differential > 0:
            return f"Slight value on {name}. Reasonable pick for a {star_rating}⭐ {position}."
        elif pick_differential == 0:
            return f"Right on consensus for {name}. {star_rating}⭐ {position} taken at expected value."
        elif pick_differential > -10:
            return f"Mild reach on {name}. {star_rating}⭐ {position} selected slightly ahead of consensus."
        elif pick_differential > -20:
            return f"Notable reach on {name}. {position} taken significantly above consensus value."
        else:
            return f"Major reach on {name}. {star_rating}⭐ {position} selected far above consensus ranking."
    
    def evaluate_draft_sequence(self, picks: List[Dict[str, Any]], 
                               draft_type: str = 'startup', year: str = None) -> Dict[str, Any]:
        """
        Evaluate a sequence of draft picks.
        
        Args:
            picks: List of dicts with 'player_name' and 'pick_number'
            draft_type: 'startup' or 'rookie_only'
            year: Rookie year to evaluate against
        
        Returns:
            Comprehensive draft evaluation
        """
        evaluations = []
        rookie_picks = []
        
        for pick_info in picks:
            evaluation = self.evaluate_pick(
                pick_info['player_name'],
                pick_info['pick_number'],
                draft_type,
                year
            )
            
            evaluations.append(evaluation)
            
            # Track rookie-specific picks
            if evaluation.get('found') and evaluation.get('rookie_flag'):
                rookie_picks.append(evaluation)
        
        # Calculate draft summary
        if rookie_picks:
            avg_value_score = sum(p['value_score'] for p in rookie_picks) / len(rookie_picks)
            total_differential = sum(p['pick_differential'] for p in rookie_picks)
            
            # Identify best and worst picks
            best_pick = max(rookie_picks, key=lambda x: x['value_score'])
            worst_pick = min(rookie_picks, key=lambda x: x['value_score'])
        else:
            avg_value_score = 0
            total_differential = 0
            best_pick = None
            worst_pick = None
        
        summary = {
            'total_picks_evaluated': len(evaluations),
            'rookie_picks': len(rookie_picks),
            'avg_value_score': round(avg_value_score, 1),
            'total_pick_differential': total_differential,
            'best_rookie_pick': best_pick,
            'worst_rookie_pick': worst_pick,
            'draft_type': draft_type,
            'year': year or self.pipeline.current_year
        }
        
        return {
            'success': True,
            'evaluations': evaluations,
            'rookie_evaluations': rookie_picks,
            'summary': summary
        }
    
    def get_available_rookies(self, year: str = None, position: str = None) -> List[Dict[str, Any]]:
        """Get available rookies for draft room selection"""
        if year is None:
            year = self.pipeline.current_year
        
        rookies = self.consensus_rankings.get(year, [])
        
        if position:
            rookies = [r for r in rookies if r['position'] == position.upper()]
        
        # Add draft recommendation info
        for rookie in rookies:
            rookie['draft_recommendation'] = self._get_draft_recommendation(rookie)
        
        return rookies
    
    def _get_draft_recommendation(self, rookie: Dict[str, Any]) -> str:
        """Generate draft recommendation based on player attributes"""
        star_rating = rookie['star_rating']
        tier = rookie['dynasty_tier']
        
        if star_rating >= 4.5 and tier == 'Tier 1':
            return "Must-draft prospect - elite ceiling"
        elif star_rating >= 4.0 and tier in ['Tier 1', 'Tier 2']:
            return "High priority - strong upside"
        elif star_rating >= 3.5:
            return "Solid option - good value potential"
        else:
            return "Deep flyer - late round target"
    
    def filter_rookies_by_flags(self, rookies: List[Dict], 
                               rookie_only: bool = False) -> List[Dict]:
        """Filter rookies based on rookie_flag and other criteria"""
        if rookie_only:
            return [r for r in rookies if r.get('rookie_flag', False)]
        
        return rookies

# Global evaluator instance
draft_evaluator = DraftRoomEvaluator()

def get_draft_evaluator() -> DraftRoomEvaluator:
    """Get global draft evaluator instance"""
    return draft_evaluator

if __name__ == "__main__":
    # Test draft evaluator
    evaluator = DraftRoomEvaluator()
    
    # Test single pick evaluation
    test_evaluation = evaluator.evaluate_pick("Travis Hunter", 8, "startup", "2025")
    
    print("🏈 DRAFT ROOM EVALUATOR TEST")
    print("=" * 40)
    
    if test_evaluation.get('found'):
        print(f"Player: {test_evaluation['player_name']}")
        print(f"Pick: {test_evaluation['actual_pick']} (Expected: {test_evaluation['expected_pick']})")
        print(f"Grade: {test_evaluation['grade']} - {test_evaluation['grade_description']}")
        print(f"Value Score: {test_evaluation['value_score']}")
        print(f"Notes: {test_evaluation['evaluation_notes']}")
    else:
        print("Test failed:", test_evaluation.get('error'))