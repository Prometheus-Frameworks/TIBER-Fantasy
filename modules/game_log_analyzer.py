"""
Game Log Analyzer - Fetch and analyze 2024 NFL game logs
Demonstrates elite RB performance patterns and injury impact scenarios
"""

import requests
import json
from datetime import datetime
from typing import Dict, List, Optional

class GameLogAnalyzer:
    def __init__(self):
        self.sleeper_base_url = "https://api.sleeper.app/v1"
        self.season = "2024"
        self.season_type = "regular"
        
    def fetch_player_game_logs(self, player_name: str, weeks: Optional[List[int]] = None) -> Dict:
        """
        Fetch game logs for a specific player across specified weeks
        """
        if weeks is None:
            weeks = list(range(1, 19))  # Weeks 1-18
            
        all_logs = []
        player_found = False
        
        for week in weeks:
            try:
                url = f"{self.sleeper_base_url}/stats/nfl/{self.season}/{self.season_type}/{week}"
                response = requests.get(url, timeout=10)
                
                if response.status_code == 200:
                    week_data = response.json()
                    
                    # Search for player in this week's data
                    for player_id, stats in week_data.items():
                        if 'player_name' in stats and player_name.lower() in stats.get('player_name', '').lower():
                            player_found = True
                            log_entry = {
                                'week': week,
                                'player_name': stats.get('player_name', ''),
                                'team': stats.get('team', ''),
                                'position': stats.get('pos', ''),
                                'fantasy_points': stats.get('pts_ppr', 0),
                                'rushing_yards': stats.get('rush_yd', 0),
                                'rushing_tds': stats.get('rush_td', 0),
                                'carries': stats.get('rush_att', 0),
                                'receiving_yards': stats.get('rec_yd', 0),
                                'receiving_tds': stats.get('rec_td', 0),
                                'receptions': stats.get('rec', 0),
                                'targets': stats.get('rec_tgt', 0)
                            }
                            all_logs.append(log_entry)
                            break
                            
            except Exception as e:
                print(f"Error fetching week {week} data: {e}")
                continue
                
        return {
            'player_name': player_name,
            'found': player_found,
            'total_games': len(all_logs),
            'game_logs': sorted(all_logs, key=lambda x: x['week'])
        }
    
    def analyze_elite_rb_patterns(self, player_logs: Dict) -> Dict:
        """
        Analyze game logs for elite RB patterns - explosive games, consistency, etc.
        """
        if not player_logs['found'] or not player_logs['game_logs']:
            return {'error': 'No game logs found for analysis'}
            
        logs = player_logs['game_logs']
        fantasy_points = [log['fantasy_points'] for log in logs if log['fantasy_points'] > 0]
        
        if not fantasy_points:
            return {'error': 'No fantasy points data available'}
            
        analysis = {
            'total_games': len(fantasy_points),
            'average_points': round(sum(fantasy_points) / len(fantasy_points), 2),
            'max_game': max(fantasy_points),
            'explosive_games_25plus': len([pts for pts in fantasy_points if pts >= 25]),
            'explosive_games_30plus': len([pts for pts in fantasy_points if pts >= 30]),
            'boom_rate_25plus': round(len([pts for pts in fantasy_points if pts >= 25]) / len(fantasy_points) * 100, 1),
            'consistency_15plus': len([pts for pts in fantasy_points if pts >= 15]),
            'floor_games_under_10': len([pts for pts in fantasy_points if pts < 10]),
            'weekly_breakdown': []
        }
        
        # Add weekly breakdown for visual analysis
        for log in logs:
            if log['fantasy_points'] > 0:
                analysis['weekly_breakdown'].append({
                    'week': log['week'],
                    'points': log['fantasy_points'],
                    'rush_yd': log['rushing_yards'],
                    'rush_td': log['rushing_tds'],
                    'rec': log['receptions'],
                    'rec_yd': log['receiving_yards'],
                    'explosion_flag': log['fantasy_points'] >= 25
                })
                
        return analysis
    
    def compare_teammate_impact(self, primary_player: str, teammate: str) -> Dict:
        """
        Compare performance when teammate is active vs injured
        """
        primary_logs = self.fetch_player_game_logs(primary_player)
        teammate_logs = self.fetch_player_game_logs(teammate)
        
        if not primary_logs['found']:
            return {'error': f'{primary_player} logs not found'}
            
        # Get weeks where teammate played vs didn't play
        teammate_active_weeks = set()
        if teammate_logs['found']:
            teammate_active_weeks = {log['week'] for log in teammate_logs['game_logs'] if log['fantasy_points'] > 0}
            
        primary_with_teammate = []
        primary_without_teammate = []
        
        for log in primary_logs['game_logs']:
            if log['fantasy_points'] > 0:
                if log['week'] in teammate_active_weeks:
                    primary_with_teammate.append(log['fantasy_points'])
                else:
                    primary_without_teammate.append(log['fantasy_points'])
                    
        comparison = {
            'primary_player': primary_player,
            'teammate': teammate,
            'with_teammate': {
                'games': len(primary_with_teammate),
                'avg_points': round(sum(primary_with_teammate) / len(primary_with_teammate), 2) if primary_with_teammate else 0,
                'max_game': max(primary_with_teammate) if primary_with_teammate else 0
            },
            'without_teammate': {
                'games': len(primary_without_teammate),
                'avg_points': round(sum(primary_without_teammate) / len(primary_without_teammate), 2) if primary_without_teammate else 0,
                'max_game': max(primary_without_teammate) if primary_without_teammate else 0
            }
        }
        
        if primary_with_teammate and primary_without_teammate:
            comparison['impact_analysis'] = {
                'points_boost': round(comparison['without_teammate']['avg_points'] - comparison['with_teammate']['avg_points'], 2),
                'usage_increase': comparison['without_teammate']['avg_points'] > comparison['with_teammate']['avg_points']
            }
            
        return comparison

def main():
    """
    Analyze Gibbs and Barkley 2024 game logs per founder's request
    """
    analyzer = GameLogAnalyzer()
    
    print("📊 Analyzing 2024 Elite RB Game Logs...")
    print("=" * 50)
    
    # Analyze Jahmyr Gibbs
    print("\n🔥 JAHMYR GIBBS 2024 ANALYSIS")
    gibbs_logs = analyzer.fetch_player_game_logs("Jahmyr Gibbs")
    gibbs_analysis = analyzer.analyze_elite_rb_patterns(gibbs_logs)
    
    if 'error' not in gibbs_analysis:
        print(f"Games Played: {gibbs_analysis['total_games']}")
        print(f"Average Points: {gibbs_analysis['average_points']}")
        print(f"Max Game: {gibbs_analysis['max_game']}")
        print(f"25+ Point Games: {gibbs_analysis['explosive_games_25plus']} ({gibbs_analysis['boom_rate_25plus']}%)")
        print(f"30+ Point Games: {gibbs_analysis['explosive_games_30plus']}")
        
        print("\nWeekly Breakdown:")
        for week_data in gibbs_analysis['weekly_breakdown']:
            explosion_marker = "🚀" if week_data['explosion_flag'] else ""
            print(f"Week {week_data['week']}: {week_data['points']} pts {explosion_marker}")
    else:
        print(f"Error: {gibbs_analysis['error']}")
    
    # Analyze Saquon Barkley
    print(f"\n🔥 SAQUON BARKLEY 2024 ANALYSIS")
    barkley_logs = analyzer.fetch_player_game_logs("Saquon Barkley")
    barkley_analysis = analyzer.analyze_elite_rb_patterns(barkley_logs)
    
    if 'error' not in barkley_analysis:
        print(f"Games Played: {barkley_analysis['total_games']}")
        print(f"Average Points: {barkley_analysis['average_points']}")
        print(f"Max Game: {barkley_analysis['max_game']}")
        print(f"25+ Point Games: {barkley_analysis['explosive_games_25plus']} ({barkley_analysis['boom_rate_25plus']}%)")
        print(f"30+ Point Games: {barkley_analysis['explosive_games_30plus']}")
        
        # Look for the Rams game specifically
        print("\nWeekly Breakdown:")
        for week_data in barkley_analysis['weekly_breakdown']:
            explosion_marker = "🚀" if week_data['explosion_flag'] else ""
            print(f"Week {week_data['week']}: {week_data['points']} pts {explosion_marker}")
    else:
        print(f"Error: {barkley_analysis['error']}")
    
    # Analyze Gibbs vs Montgomery impact
    print(f"\n📈 GIBBS vs MONTGOMERY IMPACT ANALYSIS")
    teammate_impact = analyzer.compare_teammate_impact("Jahmyr Gibbs", "David Montgomery")
    
    if 'error' not in teammate_impact:
        print(f"With Montgomery: {teammate_impact['with_teammate']['avg_points']} avg pts ({teammate_impact['with_teammate']['games']} games)")
        print(f"Without Montgomery: {teammate_impact['without_teammate']['avg_points']} avg pts ({teammate_impact['without_teammate']['games']} games)")
        
        if 'impact_analysis' in teammate_impact:
            boost = teammate_impact['impact_analysis']['points_boost']
            print(f"Points Boost Without Montgomery: +{boost} per game")
    else:
        print(f"Error: {teammate_impact['error']}")

if __name__ == "__main__":
    main()