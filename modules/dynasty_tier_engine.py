#!/usr/bin/env python3
"""
Dynasty Tier Engine Module
Feeds rookie data into existing tier logic for dynasty rankings.
Allows rookies to be ranked alongside veterans with proper tier weighting.
"""

from typing import Dict, List, Any, Optional
from modules.rookie_pipeline import get_rookie_pipeline
from modules.intake_module import get_all_players

class DynastyTierEngine:
    """
    Integrates rookie data into dynasty tier system.
    Combines established players with rookies for comprehensive rankings.
    """
    
    def __init__(self):
        self.pipeline = get_rookie_pipeline()
        self.tier_thresholds = {
            'Tier 1': {'min_score': 90, 'description': 'Elite Dynasty Assets'},
            'Tier 2': {'min_score': 75, 'description': 'Premium Dynasty Players'},
            'Tier 3': {'min_score': 60, 'description': 'Solid Dynasty Contributors'},
            'Tier 4': {'min_score': 45, 'description': 'Depth Dynasty Players'},
            'Tier 5': {'min_score': 30, 'description': 'Bench/Flyer Dynasty Assets'},
            'Tier 6': {'min_score': 0, 'description': 'Deep Dynasty Stashes'}
        }
        
        # Tier weight components
        self.tier_weights = {
            'draft_capital': 0.40,  # Heavy weight for draft capital
            'star_rating': 0.35,    # Medium weight for star rating
            'ceiling_sentiment': 0.15,  # Light weight for ceiling summary
            'age_factor': 0.10      # Age consideration
        }
    
    def calculate_dynasty_tier_score(self, player_data: Dict[str, Any]) -> float:
        """
        Calculate comprehensive dynasty tier score for any player.
        Works for both rookies and established players.
        """
        is_rookie = player_data.get('rookie_flag', False)
        
        if is_rookie:
            return self._calculate_rookie_tier_score(player_data)
        else:
            return self._calculate_veteran_tier_score(player_data)
    
    def _calculate_rookie_tier_score(self, rookie_data: Dict[str, Any]) -> float:
        """Calculate tier score specifically for rookies"""
        score = 0.0
        
        # Draft capital component (40% weight)
        draft_score = self._get_draft_capital_score(rookie_data.get('draft_capital', ''))
        score += draft_score * self.tier_weights['draft_capital']
        
        # Star rating component (35% weight)
        star_rating = rookie_data.get('star_rating', 2.5)
        star_score = (star_rating / 5.0) * 100
        score += star_score * self.tier_weights['star_rating']
        
        # Ceiling sentiment component (15% weight)
        ceiling_score = self._analyze_ceiling_sentiment(
            rookie_data.get('ceiling_summary', '') or 
            rookie_data.get('future_ceiling_summary', '')
        )
        score += ceiling_score * self.tier_weights['ceiling_sentiment']
        
        # Age factor for rookies (10% weight)
        age_score = 95.0  # Rookies get high age score (22-23 years old)
        score += age_score * self.tier_weights['age_factor']
        
        return round(score, 1)
    
    def _calculate_veteran_tier_score(self, player_data: Dict[str, Any]) -> float:
        """Calculate tier score for established players"""
        score = 0.0
        
        # For veterans, use different weighting
        # Production becomes more important than draft capital
        
        # Production component (40% - replaces draft capital)
        projected_points = player_data.get('projected_points', 0)
        production_score = min(100.0, (projected_points / 300.0) * 100)  # Cap at 300 points
        score += production_score * 0.40
        
        # Age component (35% - higher weight for vets)
        age = player_data.get('age', 30)
        age_score = self._calculate_age_score(age)
        score += age_score * 0.35
        
        # Position value (15%)
        position_score = self._get_position_value_score(player_data.get('position', ''))
        score += position_score * 0.15
        
        # Consistency factor (10%)
        consistency_score = 75.0  # Base consistency for established players
        score += consistency_score * 0.10
        
        return round(score, 1)
    
    def _get_draft_capital_score(self, draft_capital: str) -> float:
        """Convert draft capital to tier score (0-100)"""
        if "Round 1" in draft_capital or "Pick 1" in draft_capital or "Pick 2" in draft_capital:
            return 100.0
        elif "Round 1" in draft_capital:
            return 90.0
        elif "Round 2" in draft_capital:
            return 75.0
        elif "Round 3" in draft_capital:
            return 60.0
        elif "Round 4" in draft_capital:
            return 45.0
        elif "Round 5" in draft_capital:
            return 30.0
        elif "Round 6" in draft_capital:
            return 20.0
        elif "Round 7" in draft_capital:
            return 15.0
        elif "UDFA" in draft_capital:
            return 10.0
        else:
            return 50.0  # TBD/Unknown
    
    def _analyze_ceiling_sentiment(self, ceiling_text: str) -> float:
        """Analyze ceiling summary for positive/negative sentiment"""
        if not ceiling_text:
            return 50.0
        
        positive_keywords = [
            "elite", "wr1", "rb1", "qb1", "te1", "generational", "ceiling", 
            "upside", "potential", "star", "fantasy", "immediate", "top",
            "heisman", "exceptional", "explosive", "dominant"
        ]
        
        negative_keywords = [
            "limited", "bust", "concerns", "risk", "inconsistent", 
            "depth", "bench", "backup", "replacement", "limited"
        ]
        
        text_lower = ceiling_text.lower()
        
        positive_count = sum(1 for word in positive_keywords if word in text_lower)
        negative_count = sum(1 for word in negative_keywords if word in text_lower)
        
        # Base score of 50, adjust based on sentiment
        sentiment_score = 50.0
        sentiment_score += (positive_count * 12) - (negative_count * 8)
        
        return max(0.0, min(100.0, sentiment_score))
    
    def _calculate_age_score(self, age: int) -> float:
        """Calculate age score for dynasty purposes (younger = better)"""
        if age <= 23:
            return 100.0
        elif age <= 25:
            return 90.0
        elif age <= 27:
            return 80.0
        elif age <= 29:
            return 65.0
        elif age <= 31:
            return 45.0
        elif age <= 33:
            return 25.0
        else:
            return 10.0
    
    def _get_position_value_score(self, position: str) -> float:
        """Position value scores for dynasty"""
        position_values = {
            'QB': 85.0,  # High value in dynasty
            'RB': 60.0,  # Lower due to shorter careers
            'WR': 80.0,  # High value, longer careers
            'TE': 70.0   # Medium value
        }
        return position_values.get(position, 50.0)
    
    def assign_dynasty_tier(self, tier_score: float) -> str:
        """Assign dynasty tier based on calculated score"""
        for tier, info in self.tier_thresholds.items():
            if tier_score >= info['min_score']:
                return tier
        return 'Tier 6'
    
    def get_combined_dynasty_rankings(self, year: str = None, 
                                    position: str = None,
                                    include_rookies: bool = True) -> List[Dict[str, Any]]:
        """
        Get combined dynasty rankings with rookies and veterans.
        Applies proper tier scoring to all players.
        """
        # Get established players
        established_players = get_all_players('dynasty')
        
        # Get rookies if requested
        rookies = []
        if include_rookies:
            if year is None:
                year = self.pipeline.current_year
            rookies = self.pipeline.get_rookies_for_rankings(year=year)
        
        # Combine and process all players
        all_players = []
        
        # Process established players
        for player in established_players:
            tier_score = self._calculate_veteran_tier_score(player)
            dynasty_tier = self.assign_dynasty_tier(tier_score)
            
            player_data = {
                'player_id': player.get('name', '').lower().replace(' ', '_'),
                'name': player.get('name', ''),
                'position': player.get('position', ''),
                'team': player.get('team', ''),
                'age': player.get('age', 0),
                'tier_score': tier_score,
                'dynasty_tier': dynasty_tier,
                'rookie_flag': False,
                'player_type': 'veteran',
                'projected_points': player.get('projected_points', 0)
            }
            
            all_players.append(player_data)
        
        # Process rookies
        for rookie in rookies:
            tier_score = self._calculate_rookie_tier_score(rookie)
            dynasty_tier = self.assign_dynasty_tier(tier_score)
            
            rookie_data = {
                'player_id': rookie.get('player_id', ''),
                'name': rookie.get('name', ''),
                'position': rookie.get('position', ''),
                'team': rookie.get('team', ''),
                'age': 22,  # Standard rookie age
                'tier_score': tier_score,
                'dynasty_tier': dynasty_tier,
                'rookie_flag': True,
                'player_type': 'rookie',
                'star_rating': rookie.get('star_rating', 0),
                'draft_capital': rookie.get('draft_capital', ''),
                'ceiling_summary': rookie.get('ceiling_summary', '')
            }
            
            all_players.append(rookie_data)
        
        # Filter by position if specified
        if position:
            all_players = [p for p in all_players if p['position'] == position.upper()]
        
        # Sort by tier score (highest first)
        all_players.sort(key=lambda x: x['tier_score'], reverse=True)
        
        # Add overall ranks
        for i, player in enumerate(all_players, 1):
            player['dynasty_rank'] = i
        
        return all_players
    
    def get_tier_analysis(self, year: str = None) -> Dict[str, Any]:
        """Get comprehensive tier analysis across all players"""
        rankings = self.get_combined_dynasty_rankings(year=year)
        
        # Group by tiers
        tier_groups = {}
        rookie_counts = {}
        veteran_counts = {}
        
        for player in rankings:
            tier = player['dynasty_tier']
            
            if tier not in tier_groups:
                tier_groups[tier] = []
                rookie_counts[tier] = 0
                veteran_counts[tier] = 0
            
            tier_groups[tier].append(player)
            
            if player['rookie_flag']:
                rookie_counts[tier] += 1
            else:
                veteran_counts[tier] += 1
        
        # Calculate tier statistics
        tier_stats = {}
        for tier, players in tier_groups.items():
            tier_stats[tier] = {
                'total_players': len(players),
                'rookies': rookie_counts[tier],
                'veterans': veteran_counts[tier],
                'avg_tier_score': round(sum(p['tier_score'] for p in players) / len(players), 1),
                'top_player': players[0]['name'] if players else None,
                'positions': list(set(p['position'] for p in players)),
                'description': self.tier_thresholds[tier]['description']
            }
        
        return {
            'tier_statistics': tier_stats,
            'total_players': len(rankings),
            'total_rookies': sum(rookie_counts.values()),
            'total_veterans': sum(veteran_counts.values()),
            'year': year or self.pipeline.current_year
        }
    
    def compare_rookie_veteran_tiers(self, year: str = None) -> Dict[str, Any]:
        """Compare how rookies rank against veterans in each tier"""
        rankings = self.get_combined_dynasty_rankings(year=year)
        
        comparison = {
            'rookie_veteran_mix': {},
            'top_rookies_vs_veterans': {},
            'tier_integration': {}
        }
        
        # Analyze tier integration
        for tier in self.tier_thresholds.keys():
            tier_players = [p for p in rankings if p['dynasty_tier'] == tier]
            rookies = [p for p in tier_players if p['rookie_flag']]
            veterans = [p for p in tier_players if not p['rookie_flag']]
            
            comparison['tier_integration'][tier] = {
                'total': len(tier_players),
                'rookies': len(rookies),
                'veterans': len(veterans),
                'rookie_percentage': round((len(rookies) / len(tier_players)) * 100, 1) if tier_players else 0,
                'top_rookie': rookies[0]['name'] if rookies else None,
                'top_veteran': veterans[0]['name'] if veterans else None
            }
        
        return comparison

# Global tier engine instance
dynasty_tier_engine = DynastyTierEngine()

def get_dynasty_tier_engine() -> DynastyTierEngine:
    """Get global dynasty tier engine instance"""
    return dynasty_tier_engine

if __name__ == "__main__":
    # Test dynasty tier engine
    engine = DynastyTierEngine()
    
    print("🏆 DYNASTY TIER ENGINE TEST")
    print("=" * 40)
    
    # Test combined rankings
    rankings = engine.get_combined_dynasty_rankings()
    print(f"Total players in dynasty rankings: {len(rankings)}")
    
    # Show top 10
    print("\n🥇 Top 10 Dynasty Players:")
    for i, player in enumerate(rankings[:10], 1):
        rookie_indicator = "🆕" if player['rookie_flag'] else ""
        print(f"  {i}. {player['name']} ({player['position']}) - {player['dynasty_tier']} {rookie_indicator}")
    
    # Tier analysis
    tier_analysis = engine.get_tier_analysis()
    print(f"\n📊 Tier 1 Players: {tier_analysis['tier_statistics']['Tier 1']['total_players']}")
    print(f"Rookies in Tier 1: {tier_analysis['tier_statistics']['Tier 1']['rookies']}")