"""
Actual Game Log Analysis - Using real 2024 RB data
Analyzing Saquon Barkley and Jahmyr Gibbs performance patterns
"""

import json

def load_rb_game_logs():
    """Load the complete 18-week RB logs"""
    try:
        with open('complete_18_week_rb_logs.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("Game logs file not found")
        return None

def analyze_player_performance(player_data):
    """Analyze individual player performance"""
    if not player_data or 'game_logs' not in player_data:
        return None
        
    logs = player_data['game_logs']
    active_games = [log for log in logs if log['fantasy_points_ppr'] > 0]
    
    if not active_games:
        return None
    
    fantasy_points = [log['fantasy_points_ppr'] for log in active_games]
    
    analysis = {
        'player_name': player_data['player_name'],
        'team': player_data['team'],
        'total_games': len(active_games),
        'average_points': round(sum(fantasy_points) / len(fantasy_points), 2),
        'max_game': max(fantasy_points),
        'min_game': min(fantasy_points),
        'explosive_games_25plus': len([pts for pts in fantasy_points if pts >= 25]),
        'explosive_games_30plus': len([pts for pts in fantasy_points if pts >= 30]),
        'boom_rate_25plus': round(len([pts for pts in fantasy_points if pts >= 25]) / len(fantasy_points) * 100, 1),
        'consistency_15plus': len([pts for pts in fantasy_points if pts >= 15]),
        'weekly_breakdown': []
    }
    
    # Weekly breakdown with explosion markers
    for log in active_games:
        week_analysis = {
            'week': log['week'],
            'opponent': log.get('opponent', 'Unknown'),
            'fantasy_points': log['fantasy_points_ppr'],
            'rush_yards': log['rush_yards'],
            'rush_tds': log['rush_touchdowns'],
            'receptions': log['receptions'],
            'rec_yards': log['receiving_yards'],
            'rec_tds': log['receiving_touchdowns'],
            'explosion_flag': log['fantasy_points_ppr'] >= 25,
            'nuclear_flag': log['fantasy_points_ppr'] >= 30
        }
        analysis['weekly_breakdown'].append(week_analysis)
    
    return analysis

def find_rams_game(barkley_analysis):
    """Find the specific Rams game that cost founder 1st place"""
    if not barkley_analysis or 'weekly_breakdown' not in barkley_analysis:
        return None
        
    # Look for LA/LAR opponent
    for week_data in barkley_analysis['weekly_breakdown']:
        opponent = week_data.get('opponent', '').upper()
        if 'LA' in opponent or 'RAM' in opponent:
            return {
                'week': week_data['week'],
                'opponent': week_data['opponent'],
                'fantasy_points': week_data['fantasy_points'],
                'rush_yards': week_data['rush_yards'],
                'rush_tds': week_data['rush_tds'],
                'receptions': week_data['receptions'],
                'rec_yards': week_data['rec_yards'],
                'explosion_level': 'NUCLEAR' if week_data['nuclear_flag'] else 'BOOM' if week_data['explosion_flag'] else 'SOLID'
            }
    return None

def main():
    """Analyze the actual game logs"""
    print("📊 ANALYZING ACTUAL 2024 RB GAME LOGS")
    print("=" * 50)
    
    data = load_rb_game_logs()
    if not data:
        print("Error: Could not load game logs")
        return
        
    # Find Saquon Barkley
    barkley_data = None
    gibbs_data = None
    
    for rb in data.get('running_backs', []):
        if 'Saquon Barkley' in rb.get('player_name', ''):
            barkley_data = rb
        elif 'Jahmyr Gibbs' in rb.get('player_name', '') or 'Gibbs' in rb.get('player_name', ''):
            gibbs_data = rb
    
    # Analyze Saquon Barkley
    if barkley_data:
        print("\n🔥 SAQUON BARKLEY 2024 - THE SEASON WRECKER")
        barkley_analysis = analyze_player_performance(barkley_data)
        
        if barkley_analysis:
            print(f"Team: {barkley_analysis['team']}")
            print(f"Games Played: {barkley_analysis['total_games']}")
            print(f"Average Points: {barkley_analysis['average_points']} PPR")
            print(f"Max Game: {barkley_analysis['max_game']} points")
            print(f"25+ Point Games: {barkley_analysis['explosive_games_25plus']} ({barkley_analysis['boom_rate_25plus']}%)")
            print(f"30+ Point Games: {barkley_analysis['explosive_games_30plus']}")
            
            # Find the Rams game
            rams_game = find_rams_game(barkley_analysis)
            if rams_game:
                print(f"\n💀 THE RAMS GAME THAT COST FOUNDER 1ST PLACE:")
                print(f"Week {rams_game['week']} vs {rams_game['opponent']}: {rams_game['fantasy_points']} points")
                print(f"Rushing: {rams_game['rush_yards']} yards, {rams_game['rush_tds']} TDs")
                print(f"Receiving: {rams_game['receptions']} rec, {rams_game['rec_yards']} yards")
                print(f"Impact Level: {rams_game['explosion_level']}")
                print("Result: Founder lost by 1.3 points, missed Week 1 bye, championship dreams crushed")
            
            print(f"\nWeekly Breakdown - Elite RB Going Nuclear:")
            for week_data in barkley_analysis['weekly_breakdown']:
                explosion_marker = "🚀🚀" if week_data['nuclear_flag'] else "🚀" if week_data['explosion_flag'] else ""
                print(f"Week {week_data['week']} vs {week_data['opponent']}: {week_data['fantasy_points']} pts {explosion_marker}")
    
    # Analyze Jahmyr Gibbs  
    if gibbs_data:
        print(f"\n🔥 JAHMYR GIBBS 2024 - THE ONE THAT GOT AWAY")
        gibbs_analysis = analyze_player_performance(gibbs_data)
        
        if gibbs_analysis:
            print(f"Team: {gibbs_analysis['team']}")
            print(f"Games Played: {gibbs_analysis['total_games']}")
            print(f"Average Points: {gibbs_analysis['average_points']} PPR")
            print(f"Max Game: {gibbs_analysis['max_game']} points")
            print(f"25+ Point Games: {gibbs_analysis['explosive_games_25plus']} ({gibbs_analysis['boom_rate_25plus']}%)")
            print(f"30+ Point Games: {gibbs_analysis['explosive_games_30plus']}")
            
            print(f"\nWeekly Breakdown - The Animal Unleashed:")
            for week_data in gibbs_analysis['weekly_breakdown']:
                explosion_marker = "🚀🚀" if week_data['nuclear_flag'] else "🚀" if week_data['explosion_flag'] else ""
                print(f"Week {week_data['week']} vs {week_data['opponent']}: {week_data['fantasy_points']} pts {explosion_marker}")
    
    print(f"\n💡 ELITE RB LESSON LEARNED:")
    print("When these studs go off, you can do nothing but watch")
    print("RBs are NOT 'make belief things' - elite talent carries massive weight")
    print("Random backups don't replace true animals like Barkley and Gibbs")

if __name__ == "__main__":
    main()