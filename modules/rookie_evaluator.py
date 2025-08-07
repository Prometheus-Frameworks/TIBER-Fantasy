"""
FINAL ROOKIE EVALUATOR MODULE
Production-ready for On The Clock
Integrates all improvements from Claude, Lamar, and team
Ready for Tiber deployment
"""

from typing import Dict, List, Any, Optional
import json
import math

# Try to import scipy, fallback to basic math if not available
try:
    from scipy.stats import norm
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

# =======================
# TIER THRESHOLD CONFIG
# =======================

TIER_THRESHOLDS = {
    "WR": {"S": 90, "A": 80, "B": 70, "C": 60},
    "RB": {"S": 85, "A": 75, "B": 65, "C": 55},
    "QB": {"S": 95, "A": 85, "B": 75, "C": 65},
    "TE": {"S": 80, "A": 70, "B": 60, "C": 50}
}

# =======================
# TRAIT THRESHOLDS
# =======================

TRAIT_THRESHOLDS = {
    "WR": {
        "field_stretcher": {"40_yard_dash": 4.40, "burst_score": 130},
        "yac_specialist": {"yac_per_reception": 5.0},
        "alpha_receiver": {"target_share": 0.25, "dominator_rating": 0.30},
        "ppr_enhanced": {"receptions": 80},
        "early_breakout": {"breakout_age": 20}
    },
    "RB": {
        "elusive": {"missed_tackles_forced": 60},
        "dual_threat_back": {"receiving_yards": 500, "receptions": 40},
        "satellite_back": {"bmi": 30, "receiving_grade": 70},
        "bell_cow": {"snap_share": 0.70, "carries": 250},
        "pass_protector": {"pass_protection_grade": 75}
    },
    "QB": {
        "mobile": {"rush_yards": 300, "40_yard_dash": 4.70},
        "elite_arm_strength": {"arm_velocity_mph": 52},
        "high_efficiency": {"yards_per_attempt": 8.0, "adjusted_completion_pct": 0.70},
        "franchise_caliber": {"td_int_ratio": 2.5, "yards_per_attempt": 8.5}
    },
    "TE": {
        "receiving_specialist": {"receptions": 50, "yards_per_reception": 12.0},
        "complete_tight_end": {"receiving_grade": 75, "blocking_grade": 70},
        "seam_stretcher": {"yards_per_reception": 14.0}
    }
}

# =======================
# CORE EVALUATION FUNCTIONS
# =======================

def assign_tier(score: float, position: str = "WR") -> str:
    """Assign tier based on position-specific thresholds"""
    thresholds = TIER_THRESHOLDS.get(position, TIER_THRESHOLDS["WR"])
    if score >= thresholds["S"]:
        return "S"
    elif score >= thresholds["A"]:
        return "A"
    elif score >= thresholds["B"]:
        return "B"
    elif score >= thresholds["C"]:
        return "C"
    else:
        return "D"

def evaluate_wr(player: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate Wide Receiver prospects"""
    name = player.get("name", "Unknown")
    
    # Core metrics
    yprr = float(player.get("yprr", 0))
    receptions = float(player.get("receptions", 0))
    receiving_grade = float(player.get("receiving_grade", 0))
    breakout_age = float(player.get("breakout_age", 22))
    dominator = float(player.get("dominator_rating", 0))
    draft_round = player.get("draft_round", "UDFA")
    
    # Calculate bonuses
    age_bonus = max(0, (22 - breakout_age) * 3)
    
    # Calculate base score
    score = (yprr * 30 +                    # YPRR is king for WRs
             receptions * 0.2 +              # Volume matters
             receiving_grade * 0.3 +          # Efficiency
             dominator * 20 +                 # Team dominance
             age_bonus)                       # Early breakout bonus
    
    # Draft capital boost
    if draft_round in ["1", "2"]:
        score += 5
    elif draft_round in ["3", "4"]:
        score += 2
    
    # Determine tier
    tier = assign_tier(score, "WR")
    
    # Check for special traits
    traits = validate_traits(player, "WR")
    
    return {
        "name": name,
        "position": "WR",
        "tier": tier,
        "score": round(score, 2),
        "traits": traits,
        "notes": f"WR scored {score:.2f} - Breakout age {breakout_age}, Dominator {dominator:.1%}"
    }

def evaluate_rb(player: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate Running Back prospects"""
    name = player.get("name", "Unknown")
    
    # Core metrics
    receiving_grade = float(player.get("receiving_grade", 0)) * 1.15  # Normalize vs WRs
    yards_per_carry = float(player.get("yards_per_carry", 0))
    receptions = float(player.get("receptions", 0))
    missed_tackles = float(player.get("missed_tackles_forced", 0))
    pass_pro = float(player.get("pass_protection_grade", 0))
    draft_round = player.get("draft_round", "UDFA")
    
    # Calculate bonuses
    elusive_bonus = min(missed_tackles * 0.2, 15)
    
    # Calculate base score
    score = (receiving_grade * 0.3 +         # Receiving backs valuable
             min(yards_per_carry * 8, 50) +  # YPC capped at 50
             receptions * 0.2 +               # PPR value
             elusive_bonus +                  # Elusiveness
             pass_pro * 0.1)                  # Pass protection keeps them on field
    
    # Draft capital boost
    if draft_round in ["1", "2"]:
        score += 5
    elif draft_round in ["3", "4"]:
        score += 2
    
    # Determine tier
    tier = assign_tier(score, "RB")
    
    # Check for special traits
    traits = validate_traits(player, "RB")
    
    return {
        "name": name,
        "position": "RB",
        "tier": tier,
        "score": round(score, 2),
        "traits": traits,
        "notes": f"RB scored {score:.2f} - {missed_tackles} MTF, {yards_per_carry:.1f} YPC"
    }

def evaluate_qb(player: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate Quarterback prospects"""
    name = player.get("name", "Unknown")
    
    # Core metrics
    ypa = float(player.get("yards_per_attempt", 0))
    adj_comp_pct = float(player.get("adjusted_completion_pct", 0))
    td_int = float(player.get("td_int_ratio", 0))
    rush_yards = float(player.get("rush_yards", 0))
    draft_round = player.get("draft_round", "UDFA")
    
    # Calculate bonuses
    mobility_bonus = min(rush_yards / 100, 10)
    
    # Calculate base score
    score = (ypa * 8 +                       # Deep ball ability
             adj_comp_pct * 60 +              # Accuracy (as percentage)
             td_int * 10 +                    # TD/INT ratio crucial
             mobility_bonus)                  # Rushing upside
    
    # Draft capital boost (bigger for QBs)
    if draft_round == "1":
        score += 10
    elif draft_round in ["2", "3"]:
        score += 5
    
    # Determine tier
    tier = assign_tier(score, "QB")
    
    # Check for special traits
    traits = validate_traits(player, "QB")
    
    return {
        "name": name,
        "position": "QB",
        "tier": tier,
        "score": round(score, 2),
        "traits": traits,
        "notes": f"QB scored {score:.2f} - {ypa:.1f} YPA, {rush_yards:.0f} rush yards"
    }

def evaluate_te(player: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate Tight End prospects"""
    name = player.get("name", "Unknown")
    
    # Core metrics
    receiving_grade = float(player.get("receiving_grade", 0))
    receptions = float(player.get("receptions", 0))
    yards_per_reception = float(player.get("yards_per_reception", 0))
    draft_round = player.get("draft_round", "UDFA")
    
    # Calculate bonuses
    reception_bonus = min(receptions * 0.5, 25)
    
    # Calculate base score
    score = (receiving_grade * 0.4 +         # Receiving ability
             yards_per_reception * 2 +       # Big play ability
             reception_bonus)                 # Volume bonus
    
    # Draft capital boost
    if draft_round in ["1", "2"]:
        score += 5
    elif draft_round in ["3", "4"]:
        score += 3
    
    # Determine tier
    tier = assign_tier(score, "TE")
    
    # Check for special traits
    traits = validate_traits(player, "TE")
    
    return {
        "name": name,
        "position": "TE",
        "tier": tier,
        "score": round(score, 2),
        "traits": traits,
        "notes": f"TE scored {score:.2f} - {receptions} rec, {yards_per_reception:.1f} YPR"
    }

# =======================
# TRAIT VALIDATION
# =======================

def validate_traits(player: Dict[str, Any], position: str) -> List[str]:
    """Validate which traits a player qualifies for"""
    if position not in TRAIT_THRESHOLDS:
        return []
    
    qualified_traits = []
    position_thresholds = TRAIT_THRESHOLDS[position]
    
    for trait, requirements in position_thresholds.items():
        qualifies = True
        for metric, threshold in requirements.items():
            player_value = player.get(metric, 0)
            
            # Handle different threshold comparisons
            if metric in ["40_yard_dash", "breakout_age", "bmi"]:  # Lower is better
                if player_value > threshold or player_value == 0:
                    qualifies = False
                    break
            else:  # Higher is better
                if player_value < threshold:
                    qualifies = False
                    break
        
        if qualifies:
            qualified_traits.append(trait)
    
    return qualified_traits

# =======================
# ROUTER FUNCTION
# =======================

def evaluate_rookie(player: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entry point for rookie evaluation
    Routes to appropriate position evaluator
    """
    position = player.get("position", "").upper()
    
    # Handle special cases
    if "Travis Hunter" in player.get("name", ""):
        return {
            "name": "Travis Hunter",
            "position": "WR/CB",
            "tier": "Σ",  # Beyond S-tier
            "score": 999.99,
            "traits": ["two_way_player", "generational", "position_breaker"],
            "notes": "System exception: Evaluate as both WR and CB. Draft immediately."
        }
    
    # Standard evaluation routing
    evaluators = {
        "WR": evaluate_wr,
        "RB": evaluate_rb,
        "QB": evaluate_qb,
        "TE": evaluate_te
    }
    
    if position in evaluators:
        result = evaluators[position](player)
        
        # Add dynasty-specific flags
        result["flags"] = determine_flags(result, player)
        
        # Add compass integration data
        result["compass_ready"] = prepare_compass_data(player, position)
        
        return result
    else:
        return {
            "name": player.get("name", "Unknown"),
            "position": position,
            "tier": "Unranked",
            "score": 0,
            "traits": [],
            "flags": [],
            "notes": f"Position {position} not yet supported"
        }

# =======================
# FLAG DETERMINATION
# =======================

def determine_flags(result: Dict[str, Any], player: Dict[str, Any]) -> List[str]:
    """Determine dynasty-relevant flags"""
    flags = []
    
    # Tier-based flags
    if result["tier"] == "S":
        flags.append("elite_prospect")
    elif result["tier"] == "A":
        flags.append("high_upside")
    
    # Age-based flags
    age = player.get("age", 22)
    if age <= 21:
        flags.append("development_track")
    elif age >= 24:
        flags.append("immediate_contributor")
    
    # Position-specific flags
    position = result["position"]
    if position == "RB" and "satellite_back" in result.get("traits", []):
        flags.append("ppr_enhanced")
    elif position == "QB" and "mobile" in result.get("traits", []):
        flags.append("superflex_enhanced")
    elif position == "WR" and "alpha_receiver" in result.get("traits", []):
        flags.append("target_hog")
    
    # Competition/situation flags
    if player.get("depth_chart_rank", 3) >= 3:
        flags.append("competition_risk")
    
    return flags

# =======================
# COMPASS INTEGRATION
# =======================

def prepare_compass_data(player: Dict[str, Any], position: str) -> Dict[str, Any]:
    """Prepare data for existing compass scoring systems"""
    if position == "RB":
        return {
            "player_metrics": {
                "rush_att": player.get("carries", 200),
                "tgt_share": player.get("target_share", 0.15),
                "gl_carries": player.get("goal_line_carries", 10),
                "yac_per_att": player.get("yac_per_attempt", 2.5),
                "breakaway_pct": player.get("breakaway_pct", 0.05)
            },
            "age": player.get("age", 22),
            "games_missed_2yr": 0,  # Rookies have no NFL injury history
            "fum_rate": player.get("fumble_rate", 0.01)
        }
    elif position == "WR":
        return {
            "anchor_score": player.get("dominator_rating", 0.2) * 50,
            "context_tags": generate_context_tags(player),
            "rebuilder_score": calculate_rebuilder_score(player),
            "contender_score": calculate_contender_score(player),
            "age": player.get("age", 22)
        }
    else:
        return {}

def generate_context_tags(player: Dict[str, Any]) -> List[str]:
    """Generate context tags for compass integration"""
    tags = []
    
    # Draft capital tags
    draft_round = player.get("draft_round", "UDFA")
    if draft_round == "1":
        tags.append("first_round_pedigree")
    elif draft_round in ["2", "3"]:
        tags.append("day_two_selection")
    
    # Performance tags
    if player.get("dominator_rating", 0) > 0.3:
        tags.append("college_alpha")
    if player.get("breakout_age", 22) <= 20:
        tags.append("early_breakout")
    
    return tags

def calculate_rebuilder_score(player: Dict[str, Any]) -> float:
    """Calculate rebuilder score for dynasty evaluation"""
    age = player.get("age", 22)
    breakout_age = player.get("breakout_age", 22)
    
    # Younger players with early breakouts score higher for rebuilders
    age_score = max(0, (24 - age) * 0.2)
    breakout_score = max(0, (22 - breakout_age) * 0.15)
    
    return min(1.0, age_score + breakout_score)

def calculate_contender_score(player: Dict[str, Any]) -> float:
    """Calculate contender score for dynasty evaluation"""
    draft_round = player.get("draft_round", "UDFA")
    receiving_grade = player.get("receiving_grade", 60)
    
    # High draft capital and production score higher for contenders
    if draft_round in ["1", "2"]:
        draft_score = 0.4
    elif draft_round in ["3", "4"]:
        draft_score = 0.2
    else:
        draft_score = 0.0
    
    production_score = min(0.6, receiving_grade / 100)
    
    return draft_score + production_score

# =======================
# BATCH PROCESSING
# =======================

class RookieBatch:
    """Batch processing for multiple rookie evaluations"""
    
    def __init__(self):
        self.rookies: List[Dict[str, Any]] = []
        self.evaluations: List[Dict[str, Any]] = []
        self.batch_id = f"batch_{hash(str(id(self)))}"
    
    def add_rookie(self, player_data: Dict[str, Any]):
        """Add a rookie to the batch"""
        self.rookies.append(player_data)
    
    def process_batch(self) -> Dict[str, Any]:
        """Process all rookies in the batch"""
        self.evaluations = []
        for rookie in self.rookies:
            try:
                evaluation = evaluate_rookie(rookie)
                self.evaluations.append(evaluation)
            except Exception:
                pass  # Skip errors silently for API
        
        # Generate batch summary
        summary = self._generate_batch_summary()
        
        return {
            "batch_id": self.batch_id,
            "total_rookies": len(self.rookies),
            "evaluations": self.evaluations,
            "batch_summary": summary,
            "export_timestamp": "2025-01-06T00:00:00.000Z"
        }
    
    def export_json(self) -> str:
        """Export batch results as JSON for database storage"""
        batch_result = self.process_batch()
        return json.dumps(batch_result, indent=2)
    
    def export_summary(self) -> str:
        """Export human-readable summary"""
        if not self.evaluations:
            self.process_batch()  # Ensure evaluations are processed
        
        summary = "ROOKIE EVALUATION SUMMARY\n"
        summary += "=" * 40 + "\n"
        
        for position in ["QB", "RB", "WR", "TE"]:
            position_players = [r for r in self.evaluations if r.get("position") == position]
            if position_players:
                summary += f"\n{position}s:\n"
                for player in sorted(position_players, key=lambda x: x.get("score", 0), reverse=True):
                    summary += f"  {player.get('name', 'Unknown')}: Tier {player.get('tier', '?')} ({player.get('score', 0):.1f})\n"
        
        return summary
    
    def _generate_batch_summary(self) -> Dict[str, Any]:
        """Generate summary statistics for the batch"""
        if not self.evaluations:
            return {}
        
        # Count tiers
        tier_counts = {}
        position_counts = {}
        total_score = 0
        
        for eval in self.evaluations:
            tier = eval.get("tier", "D")
            position = eval.get("position", "Unknown")
            score = eval.get("score", 0)
            
            tier_counts[tier] = tier_counts.get(tier, 0) + 1
            position_counts[position] = position_counts.get(position, 0) + 1
            total_score += score
        
        return {
            "tier_distribution": tier_counts,
            "position_breakdown": position_counts,
            "average_score": round(total_score / len(self.evaluations), 2),
            "elite_prospects": tier_counts.get("S", 0),
            "solid_prospects": tier_counts.get("A", 0) + tier_counts.get("B", 0)
        }

# =======================
# EXPORT FUNCTIONS
# =======================

def batch_evaluate_from_json(json_file_path: str) -> str:
    """Evaluate rookies from JSON file and return results"""
    try:
        with open(json_file_path, 'r') as f:
            rookie_data = json.load(f)
        
        batch = RookieBatch()
        
        # Handle both single player and list of players
        if isinstance(rookie_data, list):
            for player in rookie_data:
                batch.add_rookie(player)
        else:
            batch.add_rookie(rookie_data)
        
        return batch.export_json()
    
    except Exception as e:
        return json.dumps({"error": f"Failed to process batch: {str(e)}"})

if __name__ == "__main__":
    # Test the system
    test_player = {
        "name": "Malik Nabers",
        "position": "WR",
        "yprr": 2.8,
        "receptions": 89,
        "receiving_grade": 85.4,
        "breakout_age": 20.5,
        "dominator_rating": 0.32,
        "draft_round": "1"
    }
    
    result = evaluate_rookie(test_player)
    print(json.dumps(result, indent=2))