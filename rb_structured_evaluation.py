import pandas as pd
import json
import numpy as np

# Load the RB data
rb_data = pd.read_csv('rb_sample_logs_2024.csv')

def calculate_advanced_metrics(player_data):
    """Calculate advanced RB metrics from game logs"""
    metrics = {}
    
    # Basic totals
    metrics['games_played'] = len(player_data)
    metrics['total_touches'] = (player_data['rush_att'].sum() + player_data['rec'].sum())
    metrics['total_yards'] = (player_data['rush_yds'].sum() + player_data['rec_yds'].sum())
    metrics['total_tds'] = (player_data['rush_td'].sum() + player_data['rec_td'].sum())
    metrics['total_ppr_points'] = player_data['fantasy_points_ppr'].sum()
    
    # Efficiency metrics
    metrics['yards_per_touch'] = metrics['total_yards'] / metrics['total_touches'] if metrics['total_touches'] > 0 else 0
    metrics['yards_per_carry'] = player_data['rush_yds'].sum() / player_data['rush_att'].sum() if player_data['rush_att'].sum() > 0 else 0
    metrics['yards_per_reception'] = player_data['rec_yds'].sum() / player_data['rec'].sum() if player_data['rec'].sum() > 0 else 0
    metrics['ppr_per_game'] = metrics['total_ppr_points'] / metrics['games_played']
    
    # Volume metrics
    metrics['touches_per_game'] = metrics['total_touches'] / metrics['games_played']
    metrics['rush_attempts_per_game'] = player_data['rush_att'].sum() / metrics['games_played']
    metrics['targets_per_game'] = player_data['rec'].sum() / metrics['games_played']  # Using receptions as proxy
    
    # Consistency metrics
    metrics['ppr_std_dev'] = player_data['fantasy_points_ppr'].std()
    metrics['games_over_15_ppr'] = len(player_data[player_data['fantasy_points_ppr'] >= 15])
    metrics['games_over_20_ppr'] = len(player_data[player_data['fantasy_points_ppr'] >= 20])
    metrics['bust_rate'] = len(player_data[player_data['fantasy_points_ppr'] < 8]) / metrics['games_played']
    
    # TD dependency
    metrics['td_rate'] = metrics['total_tds'] / metrics['games_played']
    non_td_games = player_data[player_data['rush_td'] + player_data['rec_td'] == 0]
    metrics['non_td_ppr_avg'] = non_td_games['fantasy_points_ppr'].mean() if len(non_td_games) > 0 else 0
    
    return metrics

def analyze_role_profile(player_data, metrics):
    """Analyze RB role and usage patterns"""
    role = {}
    
    # Volume role
    if metrics['touches_per_game'] >= 18:
        role['volume_tier'] = "Workhorse"
    elif metrics['touches_per_game'] >= 14:
        role['volume_tier'] = "High-Volume"
    elif metrics['touches_per_game'] >= 10:
        role['volume_tier'] = "Committee"
    else:
        role['volume_tier'] = "Limited"
    
    # Receiving role
    if metrics['targets_per_game'] >= 5:
        role['receiving_role'] = "Pass-Catching Back"
    elif metrics['targets_per_game'] >= 3:
        role['receiving_role'] = "Moderate Receiver"
    elif metrics['targets_per_game'] >= 1:
        role['receiving_role'] = "Limited Receiver"
    else:
        role['receiving_role'] = "Pure Runner"
    
    # Red zone role
    if metrics['td_rate'] >= 1.0:
        role['redzone_role'] = "Elite Scorer"
    elif metrics['td_rate'] >= 0.6:
        role['redzone_role'] = "Strong Scorer"
    elif metrics['td_rate'] >= 0.3:
        role['redzone_role'] = "Moderate Scorer"
    else:
        role['redzone_role'] = "Limited Scorer"
    
    # Usage consistency
    touch_variance = player_data['rush_att'].std() + player_data['rec'].std()
    if touch_variance <= 5:
        role['usage_consistency'] = "Very Consistent"
    elif touch_variance <= 8:
        role['usage_consistency'] = "Consistent"
    elif touch_variance <= 12:
        role['usage_consistency'] = "Variable"
    else:
        role['usage_consistency'] = "Highly Variable"
    
    return role

def generate_tags(player_name, metrics, role):
    """Generate analytical tags based on performance"""
    tags = []
    
    # Performance tags
    if metrics['ppr_per_game'] >= 20:
        tags.append("RB1-Elite")
    elif metrics['ppr_per_game'] >= 15:
        tags.append("RB1-Solid")
    elif metrics['ppr_per_game'] >= 12:
        tags.append("RB2-Reliable")
    elif metrics['ppr_per_game'] >= 8:
        tags.append("FLEX-Option")
    else:
        tags.append("Depth-Piece")
    
    # Volume tags
    if metrics['touches_per_game'] >= 18:
        tags.append("Bell-Cow")
    if metrics['rush_attempts_per_game'] >= 15:
        tags.append("Ground-Heavy")
    if metrics['targets_per_game'] >= 4:
        tags.append("Pass-Game-Asset")
    
    # Efficiency tags
    if metrics['yards_per_touch'] >= 5.5:
        tags.append("Efficient")
    elif metrics['yards_per_touch'] <= 4.0:
        tags.append("Volume-Dependent")
    
    # TD tags
    if metrics['td_rate'] >= 0.8:
        tags.append("TD-Machine")
    elif metrics['td_rate'] <= 0.3:
        tags.append("TD-Limited")
    
    # Consistency tags
    if metrics['bust_rate'] <= 0.2:
        tags.append("High-Floor")
    elif metrics['bust_rate'] >= 0.4:
        tags.append("Volatile")
    
    if metrics['games_over_20_ppr'] >= 6:
        tags.append("Ceiling-Games")
    
    # Player-specific insights
    if player_name == "Saquon Barkley":
        tags.extend(["Explosive-Upside", "Elite-Talent", "Breakaway-Speed"])
    elif player_name == "James Conner":
        tags.extend(["Steady-Producer", "Receiving-Upside", "Injury-Concern"])
    elif player_name == "Rico Dowdle":
        tags.extend(["Late-Season-Surge", "Opportunity-Based", "TD-Regression-Risk"])
    
    return tags

def evaluate_volume_vs_talent_vs_insulation(player_name, metrics, role):
    """Evaluate the volume vs talent vs insulation principle"""
    evaluation = {}
    
    # Volume Score (0-10)
    volume_score = min(10, (metrics['touches_per_game'] / 2))
    evaluation['volume_score'] = round(volume_score, 1)
    
    # Talent Score (0-10) - based on efficiency metrics
    efficiency_composite = (metrics['yards_per_touch'] * 0.6) + (metrics['yards_per_carry'] * 0.4)
    talent_score = min(10, efficiency_composite * 1.5)
    evaluation['talent_score'] = round(talent_score, 1)
    
    # Insulation Score (0-10) - based on consistency and role security
    consistency_factor = 10 - (metrics['bust_rate'] * 10)
    role_security = 8 if role['volume_tier'] in ["Workhorse", "High-Volume"] else 5
    insulation_score = (consistency_factor * 0.6) + (role_security * 0.4)
    evaluation['insulation_score'] = round(insulation_score, 1)
    
    # Overall composite
    evaluation['composite_score'] = round((volume_score + talent_score + insulation_score) / 3, 1)
    
    # Framework analysis
    if volume_score >= 8 and talent_score >= 7:
        evaluation['framework_tier'] = "Elite (Volume + Talent)"
    elif volume_score >= 8 and insulation_score >= 7:
        evaluation['framework_tier'] = "Reliable (Volume + Insulation)"
    elif talent_score >= 8 and insulation_score >= 7:
        evaluation['framework_tier'] = "Upside (Talent + Insulation)"
    elif volume_score >= 7:
        evaluation['framework_tier'] = "Volume-Driven"
    elif talent_score >= 7:
        evaluation['framework_tier'] = "Talent-Driven"
    else:
        evaluation['framework_tier'] = "Opportunity-Dependent"
    
    return evaluation

# Process all three players
players_evaluation = {
    "rb_evaluation": {
        "evaluation_date": "2024-01-23",
        "methodology": "Volume vs Talent vs Insulation Framework",
        "data_source": "NFL-Data-Py 2024 Season",
        "players": []
    }
}

for player_name in ['Saquon Barkley', 'James Conner', 'Rico Dowdle']:
    player_data = rb_data[rb_data['player_name'] == player_name]
    
    if len(player_data) > 0:
        # Calculate all metrics
        metrics = calculate_advanced_metrics(player_data)
        role = analyze_role_profile(player_data, metrics)
        tags = generate_tags(player_name, metrics, role)
        framework_eval = evaluate_volume_vs_talent_vs_insulation(player_name, metrics, role)
        
        # Build player evaluation
        player_eval = {
            "player_name": player_name,
            "team": player_data['team'].iloc[0],
            "season": 2024,
            "advanced_metrics": {
                "production": {
                    "games_played": int(metrics['games_played']),
                    "total_touches": int(metrics['total_touches']),
                    "total_yards": int(metrics['total_yards']),
                    "total_tds": int(metrics['total_tds']),
                    "total_ppr_points": round(metrics['total_ppr_points'], 1),
                    "ppr_per_game": round(metrics['ppr_per_game'], 1)
                },
                "efficiency": {
                    "yards_per_touch": round(metrics['yards_per_touch'], 2),
                    "yards_per_carry": round(metrics['yards_per_carry'], 2),
                    "yards_per_reception": round(metrics['yards_per_reception'], 2)
                },
                "volume": {
                    "touches_per_game": round(metrics['touches_per_game'], 1),
                    "rush_attempts_per_game": round(metrics['rush_attempts_per_game'], 1),
                    "targets_per_game": round(metrics['targets_per_game'], 1)
                },
                "consistency": {
                    "ppr_std_dev": round(metrics['ppr_std_dev'], 2),
                    "games_over_15_ppr": int(metrics['games_over_15_ppr']),
                    "games_over_20_ppr": int(metrics['games_over_20_ppr']),
                    "bust_rate": round(metrics['bust_rate'], 3),
                    "non_td_ppr_avg": round(metrics['non_td_ppr_avg'], 1)
                }
            },
            "role_profile": role,
            "framework_evaluation": framework_eval,
            "analytical_tags": tags
        }
        
        players_evaluation["rb_evaluation"]["players"].append(player_eval)

# Save to JSON file
with open('rb_structured_evaluation.json', 'w') as f:
    json.dump(players_evaluation, f, indent=2)

print("=== RB STRUCTURED EVALUATION COMPLETE ===")
print(f"Generated comprehensive evaluation for {len(players_evaluation['rb_evaluation']['players'])} players")
print("\nFramework Tiers:")
for player in players_evaluation['rb_evaluation']['players']:
    print(f"  {player['player_name']}: {player['framework_evaluation']['framework_tier']}")
    print(f"    Volume: {player['framework_evaluation']['volume_score']}, Talent: {player['framework_evaluation']['talent_score']}, Insulation: {player['framework_evaluation']['insulation_score']}")

print(f"\nFull evaluation saved to rb_structured_evaluation.json")