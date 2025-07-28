#!/usr/bin/env python3
"""
Target Competition Evaluator v1.0
Evaluates player target share projections and competition context using 5-step logic chain.
Informs rookie scores, dynasty tiers, and depth chart forecasts.
"""

import json
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path

class TargetCompetitionEvaluator:
    """
    Evaluates target competition context using structured 5-step logic chain:
    1. Count high-volume target departures (50+ targets)
    2. Evaluate arrivals with proven history or high draft capital
    3. Assess positional overlap (RBs affecting slot WRs)
    4. Override logic for premium WRs (1st round, elite metrics)
    5. Adjust expected target range accordingly
    """
    
    def __init__(self):
        self.high_volume_threshold = 50  # Targets threshold for significant departures
        self.premium_wr_threshold = {
            'draft_round': 1,
            'elite_metrics': ['separation', 'route_running', 'hands'],
            'wr1_trajectory': True
        }
        
    def evaluate_target_competition(self, player_data: Dict[str, Any], 
                                  team_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Main evaluation function using 5-step logic chain
        """
        player_name = player_data.get('name', player_data.get('player_name', 'Unknown'))
        team = player_data.get('team', player_data.get('nfl_team', 'TBD'))
        position = player_data.get('position', 'WR')
        
        # Initialize evaluation structure
        evaluation = {
            'player_name': player_name,
            'team': team,
            'position': position,
            'competition_context': {
                'high_competition': False,
                'departures': [],
                'arrivals': [],
                'rb_overlap': False,
                'overlap_with': None,
                'notables': [],
                'notes': '',
                'target_range_adjustment': 'neutral'
            },
            'logic_chain_steps': {}
        }
        
        # Step 1: Count high-volume target departures
        departures = self._evaluate_target_departures(team, team_context)
        evaluation['logic_chain_steps']['step_1'] = {
            'description': 'Count high-volume target departures (50+ targets)',
            'result': departures,
            'impact': f"{len(departures)} high-volume departures identified"
        }
        evaluation['competition_context']['departures'] = departures
        
        # Step 2: Evaluate arrivals
        arrivals = self._evaluate_target_arrivals(team, team_context)
        evaluation['logic_chain_steps']['step_2'] = {
            'description': 'Evaluate arrivals with proven history or high draft capital',
            'result': arrivals,
            'impact': f"{len(arrivals)} significant arrivals identified"
        }
        evaluation['competition_context']['arrivals'] = arrivals
        
        # Step 3: Assess positional overlap
        rb_overlap = self._assess_positional_overlap(team, team_context)
        evaluation['logic_chain_steps']['step_3'] = {
            'description': 'Assess positional overlap (RBs affecting slot WRs)',
            'result': rb_overlap,
            'impact': 'RB receiving overlap detected' if rb_overlap['has_overlap'] else 'No significant RB overlap'
        }
        evaluation['competition_context']['rb_overlap'] = rb_overlap['has_overlap']
        evaluation['competition_context']['overlap_with'] = rb_overlap.get('overlap_players', [])
        
        # Step 4: Check premium WR override
        is_premium = self._check_premium_wr_override(player_data)
        evaluation['logic_chain_steps']['step_4'] = {
            'description': 'Override logic for premium WRs (1st round, elite metrics)',
            'result': is_premium,
            'impact': 'Premium WR override applied' if is_premium else 'Standard evaluation applies'
        }
        
        # Step 5: Calculate target range adjustment
        target_adjustment = self._calculate_target_range_adjustment(
            departures, arrivals, rb_overlap, is_premium
        )
        evaluation['logic_chain_steps']['step_5'] = {
            'description': 'Adjust expected target range accordingly',
            'result': target_adjustment,
            'impact': f"Target expectation: {target_adjustment['adjustment_type']}"
        }
        evaluation['competition_context']['target_range_adjustment'] = target_adjustment['adjustment_type']
        evaluation['competition_context']['expected_targets'] = target_adjustment['target_range']
        
        # Generate final assessment
        evaluation['competition_context'] = self._generate_final_assessment(
            evaluation['competition_context'], evaluation['logic_chain_steps']
        )
        
        return evaluation
    
    def _evaluate_target_departures(self, team: str, team_context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Step 1: Identify high-volume target departures (50+ targets)"""
        departures = []
        
        # Sample departure data - in production, cross-reference with game logs
        departure_data = self._get_team_departures(team)
        
        for departure in departure_data:
            if departure.get('targets', 0) >= self.high_volume_threshold:
                departures.append({
                    'player_name': departure['name'],
                    'targets': departure['targets'],
                    'position': departure.get('position', 'WR'),
                    'role': departure.get('role', 'Target earner'),
                    'impact_level': 'high' if departure['targets'] > 80 else 'medium'
                })
        
        return departures
    
    def _evaluate_target_arrivals(self, team: str, team_context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Step 2: Evaluate arrivals with proven target history or high draft capital"""
        arrivals = []
        
        # Sample arrival data - in production, cross-reference with team additions
        arrival_data = self._get_team_arrivals(team)
        
        for arrival in arrival_data:
            # Check if arrival has proven history (40+ targets) or high draft capital
            has_history = arrival.get('career_high_targets', 0) >= 40
            high_draft = arrival.get('draft_round', 7) <= 2
            
            if has_history or high_draft:
                arrivals.append({
                    'player_name': arrival['name'],
                    'career_high_targets': arrival.get('career_high_targets', 0),
                    'draft_capital': arrival.get('draft_round', 'Undrafted'),
                    'position': arrival.get('position', 'WR'),
                    'threat_level': 'high' if has_history and high_draft else 'medium'
                })
        
        return arrivals
    
    def _assess_positional_overlap(self, team: str, team_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Step 3: Assess RB receiving overlap affecting slot WRs"""
        overlap_assessment = {
            'has_overlap': False,
            'overlap_players': [],
            'overlap_type': None
        }
        
        # Sample RB receiving data - in production, cross-reference with usage patterns
        rb_data = self._get_team_rbs(team)
        
        for rb in rb_data:
            targets = rb.get('targets', 0)
            slot_rate = rb.get('slot_usage_rate', 0)
            
            # Check for significant receiving RB overlap
            if targets >= 30 and slot_rate >= 0.15:  # 15% slot usage threshold
                overlap_assessment['has_overlap'] = True
                overlap_assessment['overlap_players'].append({
                    'player_name': rb['name'],
                    'targets': targets,
                    'slot_rate': slot_rate,
                    'impact': 'Competes for slot targets'
                })
                overlap_assessment['overlap_type'] = 'rb_slot_competition'
        
        return overlap_assessment
    
    def _check_premium_wr_override(self, player_data: Dict[str, Any]) -> Dict[str, Any]:
        """Step 4: Check if player qualifies for premium WR override"""
        override_factors = {
            'is_premium': False,
            'qualifying_factors': [],
            'override_reasoning': []
        }
        
        # Check draft capital
        draft_capital = player_data.get('draft_capital', 'Round 7')
        if 'Round 1' in str(draft_capital) or draft_capital == 1:
            override_factors['qualifying_factors'].append('first_round_draft')
            override_factors['override_reasoning'].append('First round draft capital indicates priority target')
        
        # Check for elite metrics (would be cross-referenced with college data)
        college_stats = player_data.get('college_stats', {})
        if isinstance(college_stats, dict):
            latest_year = max(college_stats.keys()) if college_stats else None
            if latest_year:
                stats = college_stats[latest_year]
                receptions = stats.get('receptions', 0)
                yards = stats.get('receiving_yards', 0)
                
                if receptions >= 70 or yards >= 1000:
                    override_factors['qualifying_factors'].append('elite_college_production')
                    override_factors['override_reasoning'].append('Elite college production suggests target magnet ability')
        
        # Check star rating for WR1 trajectory
        star_rating = player_data.get('star_rating', 0)
        if star_rating >= 4.5:
            override_factors['qualifying_factors'].append('high_star_rating')
            override_factors['override_reasoning'].append('High star rating indicates elite talent level')
        
        # Determine if premium override applies
        if len(override_factors['qualifying_factors']) >= 2:
            override_factors['is_premium'] = True
        
        return override_factors
    
    def _calculate_target_range_adjustment(self, departures: List[Dict[str, Any]], 
                                         arrivals: List[Dict[str, Any]],
                                         rb_overlap: Dict[str, Any], 
                                         premium_override: Dict[str, Any]) -> Dict[str, Any]:
        """Step 5: Calculate final target range adjustment"""
        
        # Calculate departure impact
        departure_targets = sum(d['targets'] for d in departures)
        
        # Calculate arrival threat
        arrival_threat = len([a for a in arrivals if a['threat_level'] == 'high'])
        
        # Calculate base adjustment
        net_opportunity = departure_targets - (arrival_threat * 40)  # Assume 40 targets per high threat
        
        adjustment = {
            'departure_targets': departure_targets,
            'arrival_threat_level': arrival_threat,
            'rb_overlap_penalty': -15 if rb_overlap['has_overlap'] else 0,
            'premium_bonus': 20 if premium_override['is_premium'] else 0,
            'net_opportunity': net_opportunity
        }
        
        # Determine target range
        base_targets = 60  # Baseline expectation for rookie WR
        adjusted_targets = base_targets + (net_opportunity * 0.3) + adjustment['rb_overlap_penalty'] + adjustment['premium_bonus']
        
        # Classify adjustment type
        if adjusted_targets >= 90:
            adjustment_type = 'high_opportunity'
            target_range = (80, 120)
        elif adjusted_targets >= 70:
            adjustment_type = 'moderate_opportunity'
            target_range = (60, 90)
        elif adjusted_targets >= 50:
            adjustment_type = 'neutral'
            target_range = (40, 70)
        else:
            adjustment_type = 'low_opportunity'
            target_range = (20, 50)
        
        return {
            'adjustment_type': adjustment_type,
            'target_range': target_range,
            'adjusted_projection': int(adjusted_targets),
            'calculation_details': adjustment
        }
    
    def _generate_final_assessment(self, context: Dict[str, Any], 
                                 logic_steps: Dict[str, Any]) -> Dict[str, Any]:
        """Generate final competition assessment with notes"""
        
        # Determine high competition flag
        departures_count = len(context['departures'])
        arrivals_count = len(context['arrivals'])
        
        context['high_competition'] = arrivals_count > departures_count
        
        # Generate assessment notes
        notes = []
        
        if departures_count > 0:
            total_departure_targets = sum(d['targets'] for d in context['departures'])
            notes.append(f"{departures_count} key departures opened {total_departure_targets} targets")
        
        if arrivals_count > 0:
            high_threat_arrivals = len([a for a in context['arrivals'] if a['threat_level'] == 'high'])
            notes.append(f"{arrivals_count} new arrivals ({high_threat_arrivals} high-threat)")
        
        if context['rb_overlap']:
            overlap_players = [p['player_name'] for p in context['overlap_with']]
            notes.append(f"RB overlap from {', '.join(overlap_players)} affects slot targets")
        
        adjustment = context['target_range_adjustment']
        expected_range = context.get('expected_targets', (40, 70))
        notes.append(f"Target expectation: {adjustment} ({expected_range[0]}-{expected_range[1]} range)")
        
        context['notes'] = '; '.join(notes)
        context['notables'] = [step['impact'] for step in logic_steps.values()]
        
        return context
    
    def _get_team_departures(self, team: str) -> List[Dict[str, Any]]:
        """Get team departure data - would cross-reference with game logs in production"""
        # Sample data structure - replace with actual data source
        team_departures = {
            'CHI': [
                {'name': 'DJ Moore', 'targets': 96, 'position': 'WR', 'role': 'WR1'},
                {'name': 'Keenan Allen', 'targets': 89, 'position': 'WR', 'role': 'WR2'}
            ],
            'JAX': [
                {'name': 'Calvin Ridley', 'targets': 103, 'position': 'WR', 'role': 'WR1'}
            ],
            'NYG': [
                {'name': 'Darius Slayton', 'targets': 67, 'position': 'WR', 'role': 'WR2'}
            ]
        }
        return team_departures.get(team, [])
    
    def _get_team_arrivals(self, team: str) -> List[Dict[str, Any]]:
        """Get team arrival data - would cross-reference with signings/trades"""
        team_arrivals = {
            'CHI': [
                {'name': 'Rome Odunze', 'career_high_targets': 0, 'draft_round': 1, 'position': 'WR'},
                {'name': 'Luther Burden', 'career_high_targets': 0, 'draft_round': 2, 'position': 'WR'}
            ],
            'JAX': [
                {'name': 'Gabe Davis', 'career_high_targets': 83, 'draft_round': 4, 'position': 'WR'}
            ]
        }
        return team_arrivals.get(team, [])
    
    def _get_team_rbs(self, team: str) -> List[Dict[str, Any]]:
        """Get team RB receiving data"""
        team_rbs = {
            'CHI': [
                {'name': 'D\'Andre Swift', 'targets': 45, 'slot_usage_rate': 0.22}
            ],
            'JAX': [
                {'name': 'Travis Etienne', 'targets': 52, 'slot_usage_rate': 0.18}
            ]
        }
        return team_rbs.get(team, [])

# Global evaluator instance
target_competition_evaluator = TargetCompetitionEvaluator()

def get_target_competition_evaluator() -> TargetCompetitionEvaluator:
    """Get global target competition evaluator instance"""
    return target_competition_evaluator

def evaluate_player_target_competition(player_data: Dict[str, Any], 
                                     team_context: Dict[str, Any] = None) -> Dict[str, Any]:
    """Evaluate target competition for a player"""
    return target_competition_evaluator.evaluate_target_competition(player_data, team_context)

if __name__ == "__main__":
    # Test target competition evaluator
    evaluator = TargetCompetitionEvaluator()
    
    print("🎯 TARGET COMPETITION EVALUATOR v1.0 TEST")
    print("=" * 50)
    
    # Test with sample player data
    test_players = [
        {
            'name': 'Luther Burden',
            'team': 'CHI',
            'position': 'WR',
            'draft_capital': 'Round 2',
            'star_rating': 4.5,
            'college_stats': {
                '2024': {
                    'receptions': 67,
                    'receiving_yards': 892,
                    'touchdowns': 8
                }
            }
        },
        {
            'name': 'Rome Odunze',
            'team': 'CHI',
            'position': 'WR',
            'draft_capital': 'Round 1',
            'star_rating': 4.8,
            'college_stats': {
                '2024': {
                    'receptions': 78,
                    'receiving_yards': 1164,
                    'touchdowns': 10
                }
            }
        }
    ]
    
    for player in test_players:
        evaluation = evaluator.evaluate_target_competition(player)
        
        print(f"\n{player['name']} ({player['team']}) - {player['position']}")
        print(f"Draft Capital: {player['draft_capital']}")
        
        context = evaluation['competition_context']
        print(f"Target Range: {context['target_range_adjustment']} ({context.get('expected_targets', 'TBD')})")
        print(f"High Competition: {context['high_competition']}")
        print(f"Key Factors: {context['notes']}")
        
        print("\n5-Step Logic Chain:")
        for step, details in evaluation['logic_chain_steps'].items():
            print(f"  {step}: {details['impact']}")
        
        print("-" * 40)