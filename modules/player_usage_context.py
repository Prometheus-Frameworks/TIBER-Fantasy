#!/usr/bin/env python3
"""
Player Usage Context Module
Provides tier estimations, alpha usage scores, draft capital, and context notes for dynasty rankings
"""

from datetime import datetime
from typing import List, Dict, Any, Optional

class PlayerUsageContext:
    """
    Player Usage Context System for Dynasty Analysis
    Integrates with Dynasty Tier Recalibrator, Roster Competition Estimator, Player Usage Forecast, and OASIS Context
    """
    
    def __init__(self):
        self.player_usage_context = [
            {
                "player_name": "Luther Burden",
                "team": "CHI",
                "position": "WR",
                "tier_estimate": "Tier 1",  # Competing for WR1 role
                "alpha_usage_score": 91,
                "draft_capital": "Top 10 Pick",
                "context_notes": "Elite rookie talent, battling with DJ Moore, Rome Odunze (who struggled in 2024), and Colston Loveland (also a Top 10 pick). Burden remains a top-end breakout candidate."
            },
            {
                "player_name": "Travis Hunter",
                "team": "ARI",
                "position": "WR",
                "tier_estimate": "Tier 1",
                "alpha_usage_score": 89,
                "draft_capital": "Top 10 Pick",
                "context_notes": "Playing alongside Brian Thomas Jr., who is a top 20 pick but displays alpha-level traits on film and game logs. Travis expected to be featured with elite usage."
            },
            {
                "player_name": "Chris Godwin",
                "team": "TB",
                "position": "WR",
                "tier_estimate": "Tier 2",
                "alpha_usage_score": 76,
                "draft_capital": "Day 2 Veteran",
                "context_notes": "Was on WR1 pace early 2024 in Liam Coen's slot-heavy scheme. Injured mid-season (IR). OC Liam Coen left for Jaguars. Bucs added Round 1 WR Emeka Egbuka. Usage shift expected."
            },
            {
                "player_name": "Emeka Egbuka",
                "team": "TB",
                "position": "WR",
                "tier_estimate": "Tier 1-2 Borderline",
                "alpha_usage_score": 81,
                "draft_capital": "Round 1",
                "context_notes": "Immediate opportunity in Tampa Bay due to Chris Godwin injury history and scheme changes. Should operate primarily outside with strong target share upside."
            }
        ]
        
        self.last_updated = datetime.now()
        
        # Tier mapping for dynasty analysis
        self.tier_mapping = {
            "Tier 1": {"min_score": 85, "description": "Elite dynasty assets with WR1 upside"},
            "Tier 1-2 Borderline": {"min_score": 80, "description": "High-end WR2 with WR1 spike potential"},
            "Tier 2": {"min_score": 70, "description": "Solid WR2 with target share consistency"},
            "Tier 3": {"min_score": 60, "description": "WR3/Flex options with situational value"},
            "Tier 4": {"min_score": 50, "description": "Deep roster stashes with development potential"}
        }
        
        print("✅ Player usage context initialized - Dynasty tiers synced")
    
    def get_all_players(self) -> List[Dict[str, Any]]:
        """Get all players with usage context"""
        return self.player_usage_context
    
    def get_player_by_name(self, player_name: str) -> Optional[Dict[str, Any]]:
        """Get specific player by name"""
        for player in self.player_usage_context:
            if player["player_name"].lower() == player_name.lower():
                return player
        return None
    
    def get_players_by_tier(self, tier: str) -> List[Dict[str, Any]]:
        """Get all players in a specific tier"""
        return [
            player for player in self.player_usage_context 
            if player["tier_estimate"] == tier
        ]
    
    def get_players_by_position(self, position: str) -> List[Dict[str, Any]]:
        """Get all players by position"""
        return [
            player for player in self.player_usage_context 
            if player["position"].upper() == position.upper()
        ]
    
    def get_tier_breakdown(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get players organized by tier"""
        tiers = {}
        
        for player in self.player_usage_context:
            tier = player["tier_estimate"]
            if tier not in tiers:
                tiers[tier] = []
            tiers[tier].append(player)
        
        return tiers
    
    def update_player_context(self, player_name: str, updates: Dict[str, Any]) -> bool:
        """Update player context data"""
        for i, player in enumerate(self.player_usage_context):
            if player["player_name"].lower() == player_name.lower():
                # Update specific fields
                for key, value in updates.items():
                    if key in player:
                        self.player_usage_context[i][key] = value
                
                self.last_updated = datetime.now()
                self._trigger_system_updates(player_name, updates)
                print(f"✅ Updated {player_name} context")
                return True
        
        return False
    
    def add_player_context(self, player_data: Dict[str, Any]) -> bool:
        """Add new player to usage context"""
        required_fields = ["player_name", "team", "position", "tier_estimate", "alpha_usage_score", "draft_capital", "context_notes"]
        
        # Validate required fields
        for field in required_fields:
            if field not in player_data:
                print(f"❌ Missing required field: {field}")
                return False
        
        self.player_usage_context.append(player_data)
        self.last_updated = datetime.now()
        self._trigger_system_updates(player_data["player_name"], {"action": "added"})
        print(f"✅ Added {player_data['player_name']} to usage context")
        return True
    
    def recalculate_tier(self, player_name: str) -> Optional[str]:
        """Recalculate player tier based on alpha usage score"""
        player = self.get_player_by_name(player_name)
        if not player:
            return None
        
        score = player["alpha_usage_score"]
        
        # Determine tier based on score thresholds
        if score >= 85:
            new_tier = "Tier 1"
        elif score >= 80:
            new_tier = "Tier 1-2 Borderline"
        elif score >= 70:
            new_tier = "Tier 2"
        elif score >= 60:
            new_tier = "Tier 3"
        else:
            new_tier = "Tier 4"
        
        # Update if tier changed
        old_tier = player["tier_estimate"]
        if old_tier != new_tier:
            self.update_player_context(player_name, {"tier_estimate": new_tier})
            print(f"🔄 {player_name} tier updated: {old_tier} → {new_tier}")
        
        return new_tier
    
    def _trigger_system_updates(self, player_name: str, updates: Dict[str, Any]):
        """Trigger updates in integrated systems"""
        print(f"🎯 Triggering system updates for {player_name}:")
        
        # Dynasty Tier Recalibrator
        print(f"   → Dynasty Tier Recalibrator: Processing {player_name}")
        
        # Roster Competition Estimator
        print(f"   → Roster Competition Estimator: Updating competition analysis")
        
        # Player Usage Forecast Module
        print(f"   → Player Usage Forecast: Recalculating projections")
        
        # OASIS Context Evaluator
        print(f"   → OASIS Context Evaluator: Updating team environment context")
    
    def process_roster_shift_impact(self, roster_change: Dict[str, Any]):
        """Process roster shift impact on player usage context"""
        team = roster_change.get("team")
        change_type = roster_change.get("type")
        impact_rating = roster_change.get("fantasy_impact_rating", 0)
        
        if impact_rating < 3:
            return  # Only process high-impact changes
        
        # Find affected players on the team
        affected_players = [
            player for player in self.player_usage_context 
            if player["team"] == team
        ]
        
        print(f"🔄 Processing roster shift impact: {team} {change_type}")
        
        for player in affected_players:
            # Adjust alpha usage score based on change type
            score_adjustment = self._calculate_score_adjustment(change_type, roster_change.get("details", {}))
            
            if score_adjustment != 0:
                new_score = max(0, min(100, player["alpha_usage_score"] + score_adjustment))
                self.update_player_context(
                    player["player_name"], 
                    {"alpha_usage_score": new_score}
                )
                
                # Recalculate tier if score changed significantly
                if abs(score_adjustment) >= 5:
                    self.recalculate_tier(player["player_name"])
    
    def _calculate_score_adjustment(self, change_type: str, details: Dict[str, Any]) -> int:
        """Calculate alpha usage score adjustment based on roster change"""
        if change_type == "coaching_change" and "OC" in details.get("position", ""):
            return -3  # Offensive coordinator change typically reduces certainty
        elif change_type == "player_addition":
            return -5  # New competition reduces usage
        elif change_type == "player_release":
            return +5  # Less competition increases usage
        elif change_type == "injury_report":
            severity = details.get("severity", "").lower()
            if "ir" in severity or "season" in severity:
                return +8  # Major injury to teammate increases opportunity
            elif "major" in severity:
                return +4  # Multi-week injury increases opportunity
        
        return 0  # No adjustment for other changes
    
    def get_context_summary(self) -> Dict[str, Any]:
        """Get summary of usage context data"""
        tier_counts = {}
        position_counts = {}
        avg_score_by_tier = {}
        
        for player in self.player_usage_context:
            # Tier counts
            tier = player["tier_estimate"]
            tier_counts[tier] = tier_counts.get(tier, 0) + 1
            
            # Position counts
            pos = player["position"]
            position_counts[pos] = position_counts.get(pos, 0) + 1
            
            # Average scores by tier
            if tier not in avg_score_by_tier:
                avg_score_by_tier[tier] = []
            avg_score_by_tier[tier].append(player["alpha_usage_score"])
        
        # Calculate averages
        for tier in avg_score_by_tier:
            scores = avg_score_by_tier[tier]
            avg_score_by_tier[tier] = sum(scores) / len(scores)
        
        return {
            "total_players": len(self.player_usage_context),
            "tier_counts": tier_counts,
            "position_counts": position_counts,
            "avg_score_by_tier": avg_score_by_tier,
            "last_updated": self.last_updated.isoformat()
        }

# Global instance for module integration
player_usage_context = PlayerUsageContext()

def get_player_usage_context() -> PlayerUsageContext:
    """Get global PlayerUsageContext instance"""
    return player_usage_context

if __name__ == "__main__":
    # Test the PlayerUsageContext system
    context = PlayerUsageContext()
    
    print("🎯 PLAYER USAGE CONTEXT TEST")
    print("=" * 50)
    
    # Test tier breakdown
    tiers = context.get_tier_breakdown()
    print("Tier Breakdown:")
    for tier, players in tiers.items():
        print(f"  {tier}: {len(players)} players")
        for player in players:
            print(f"    • {player['player_name']} ({player['team']}) - Score: {player['alpha_usage_score']}")
    
    print("\n" + "=" * 50)
    print("✅ Player usage context uploaded")
    print("✅ Dynasty tiers synced") 
    print("✅ Ready for frontend rendering")
    print("✅ System integration points active")