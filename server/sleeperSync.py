#!/usr/bin/env python3
"""
Sleeper API Sync System
Comprehensive solution for real-time fantasy football platform integration
Supports league data, player stats, rankings, and roster updates
"""

import requests
import json
import time
import pandas as pd
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import logging
import os
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/sleeper_sync.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class SleeperAPISync:
    def __init__(self):
        self.base_url = "https://api.sleeper.app/v1"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'FantasyWeakness-Pro/1.0',
            'Accept': 'application/json'
        })
        
        # Rate limiting
        self.rate_limit_delay = 0.1  # 100ms between requests
        self.last_request_time = 0
        
        # Sync state
        self.sync_active = False
        self.sync_thread = None
        self.sync_data = {
            'leagues': {},
            'players': {},
            'rosters': {},
            'matchups': {},
            'last_sync': None,
            'sync_errors': []
        }
        
        # Data mapping
        self.position_mapping = {
            'QB': 'QB',
            'RB': 'RB', 
            'WR': 'WR',
            'TE': 'TE',
            'K': 'K',
            'DEF': 'DEF'
        }

    def _rate_limit(self):
        """Enforce rate limiting between API calls"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.rate_limit_delay:
            sleep_time = self.rate_limit_delay - time_since_last
            time.sleep(sleep_time)
        
        self.last_request_time = time.time()

    def _make_request(self, endpoint: str, params: Dict = None) -> Optional[Dict]:
        """Make rate-limited API request to Sleeper"""
        self._rate_limit()
        
        url = f"{self.base_url}/{endpoint}"
        
        try:
            logger.debug(f"Making request to: {url}")
            response = self.session.get(url, params=params, timeout=30)
            
            if response.status_code == 429:
                logger.warning("Rate limit exceeded, waiting 60 seconds...")
                time.sleep(60)
                return self._make_request(endpoint, params)
            
            if response.status_code != 200:
                logger.error(f"API request failed: {response.status_code} - {response.text}")
                return None
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request exception: {e}")
            return None

    def get_league_info(self, league_id: str) -> Optional[Dict]:
        """Get comprehensive league information"""
        logger.info(f"Fetching league info for: {league_id}")
        
        league_data = self._make_request(f"league/{league_id}")
        if not league_data:
            return None
        
        # Get additional league data
        users = self._make_request(f"league/{league_id}/users")
        rosters = self._make_request(f"league/{league_id}/rosters")
        
        return {
            'league': league_data,
            'users': users or [],
            'rosters': rosters or []
        }

    def get_all_players(self) -> Dict:
        """Get all NFL players from Sleeper"""
        logger.info("Fetching all NFL players...")
        
        players_data = self._make_request("players/nfl")
        if not players_data:
            return {}
        
        # Filter to offensive skill positions
        skill_positions = ['QB', 'RB', 'WR', 'TE']
        filtered_players = {}
        
        for player_id, player_info in players_data.items():
            if player_info.get('position') in skill_positions:
                filtered_players[player_id] = {
                    'player_id': player_id,
                    'name': f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip(),
                    'position': player_info.get('position'),
                    'team': player_info.get('team'),
                    'age': player_info.get('age'),
                    'years_exp': player_info.get('years_exp'),
                    'height': player_info.get('height'),
                    'weight': player_info.get('weight'),
                    'active': player_info.get('active', True),
                    'injury_status': player_info.get('injury_status'),
                    'fantasy_positions': player_info.get('fantasy_positions', [])
                }
        
        logger.info(f"Filtered to {len(filtered_players)} skill position players")
        return filtered_players

    def get_league_matchups(self, league_id: str, week: int) -> List[Dict]:
        """Get matchup data for specific week"""
        logger.info(f"Fetching matchups for league {league_id}, week {week}")
        
        matchups = self._make_request(f"league/{league_id}/matchups/{week}")
        return matchups or []

    def get_league_transactions(self, league_id: str, week: int = None) -> List[Dict]:
        """Get league transactions (trades, waivers, etc.)"""
        endpoint = f"league/{league_id}/transactions"
        if week:
            endpoint += f"/{week}"
        
        logger.info(f"Fetching transactions: {endpoint}")
        transactions = self._make_request(endpoint)
        return transactions or []

    def sync_league_comprehensive(self, league_id: str) -> Dict:
        """Comprehensive league sync with all data"""
        logger.info(f"Starting comprehensive sync for league: {league_id}")
        
        sync_result = {
            'league_id': league_id,
            'sync_timestamp': datetime.now().isoformat(),
            'success': False,
            'data': {},
            'errors': []
        }
        
        try:
            # 1. Get league basic info
            league_info = self.get_league_info(league_id)
            if not league_info:
                sync_result['errors'].append("Failed to fetch league info")
                return sync_result
            
            sync_result['data']['league'] = league_info['league']
            sync_result['data']['users'] = league_info['users']
            sync_result['data']['rosters'] = league_info['rosters']
            
            # 2. Get current season info
            season = league_info['league'].get('season', '2024')
            current_week = self._get_current_nfl_week()
            
            # 3. Get matchups for current week
            matchups = self.get_league_matchups(league_id, current_week)
            sync_result['data']['current_matchups'] = matchups
            
            # 4. Get recent transactions
            transactions = self.get_league_transactions(league_id)
            sync_result['data']['transactions'] = transactions[-50:]  # Last 50 transactions
            
            # 5. Calculate fantasy scores and rankings
            roster_analysis = self._analyze_rosters(league_info['rosters'], league_info['users'])
            sync_result['data']['roster_analysis'] = roster_analysis
            
            # 6. Get playoff information if available
            if league_info['league'].get('settings', {}).get('playoff_week_start'):
                playoff_bracket = self._make_request(f"league/{league_id}/playoffs")
                sync_result['data']['playoff_bracket'] = playoff_bracket
            
            sync_result['success'] = True
            logger.info(f"Comprehensive sync completed for league: {league_id}")
            
        except Exception as e:
            logger.error(f"Comprehensive sync failed: {e}")
            sync_result['errors'].append(f"Sync exception: {str(e)}")
        
        return sync_result

    def _get_current_nfl_week(self) -> int:
        """Estimate current NFL week"""
        # Simple estimation - in production would use NFL schedule API
        now = datetime.now()
        season_start = datetime(2024, 9, 5)  # Approximate 2024 season start
        
        if now < season_start:
            return 1
        
        weeks_since_start = (now - season_start).days // 7
        return min(max(weeks_since_start + 1, 1), 18)

    def _analyze_rosters(self, rosters: List[Dict], users: List[Dict]) -> Dict:
        """Analyze roster composition and strength"""
        analysis = {}
        
        # Create user lookup
        user_lookup = {user['user_id']: user for user in users}
        
        for roster in rosters:
            owner_id = roster.get('owner_id')
            user_info = user_lookup.get(owner_id, {})
            
            analysis[roster['roster_id']] = {
                'owner': user_info.get('display_name', 'Unknown'),
                'owner_id': owner_id,
                'wins': roster.get('settings', {}).get('wins', 0),
                'losses': roster.get('settings', {}).get('losses', 0),
                'points_for': roster.get('settings', {}).get('fpts', 0),
                'points_against': roster.get('settings', {}).get('fpts_against', 0),
                'player_count': len(roster.get('players', [])),
                'starters': roster.get('starters', []),
                'bench': [p for p in roster.get('players', []) if p not in roster.get('starters', [])]
            }
        
        return analysis

    def start_real_time_sync(self, league_id: str, sync_interval: int = 300):
        """Start real-time sync in background thread"""
        if self.sync_active:
            logger.warning("Sync already active")
            return
        
        logger.info(f"Starting real-time sync for league {league_id} (interval: {sync_interval}s)")
        
        self.sync_active = True
        self.sync_thread = threading.Thread(
            target=self._real_time_sync_worker,
            args=(league_id, sync_interval),
            daemon=True
        )
        self.sync_thread.start()

    def _real_time_sync_worker(self, league_id: str, sync_interval: int):
        """Background worker for real-time sync"""
        while self.sync_active:
            try:
                logger.info("Executing real-time sync...")
                
                # Quick sync - just get latest matchups and transactions
                current_week = self._get_current_nfl_week()
                
                # Get latest matchups
                matchups = self.get_league_matchups(league_id, current_week)
                self.sync_data['matchups'][current_week] = matchups
                
                # Get latest transactions
                transactions = self.get_league_transactions(league_id)
                if transactions:
                    self.sync_data['transactions'] = transactions[-10:]  # Last 10
                
                self.sync_data['last_sync'] = datetime.now().isoformat()
                logger.info("Real-time sync completed successfully")
                
                # Wait for next sync
                time.sleep(sync_interval)
                
            except Exception as e:
                logger.error(f"Real-time sync error: {e}")
                self.sync_data['sync_errors'].append({
                    'timestamp': datetime.now().isoformat(),
                    'error': str(e)
                })
                time.sleep(sync_interval)

    def stop_real_time_sync(self):
        """Stop real-time sync"""
        if self.sync_active:
            logger.info("Stopping real-time sync...")
            self.sync_active = False
            if self.sync_thread:
                self.sync_thread.join(timeout=10)

    def export_sync_data(self, output_file: str = '/tmp/sleeper_sync_data.json'):
        """Export sync data to JSON file"""
        try:
            with open(output_file, 'w') as f:
                json.dump(self.sync_data, f, indent=2, default=str)
            
            logger.info(f"Sync data exported to: {output_file}")
            return True
            
        except Exception as e:
            logger.error(f"Export failed: {e}")
            return False

    def validate_sync_data(self, league_id: str) -> Dict:
        """Validate sync data integrity"""
        validation_result = {
            'is_valid': True,
            'checks': {},
            'issues': []
        }
        
        # Test basic API connectivity
        league_info = self.get_league_info(league_id)
        validation_result['checks']['api_connectivity'] = league_info is not None
        
        if not league_info:
            validation_result['is_valid'] = False
            validation_result['issues'].append("Cannot connect to Sleeper API")
            return validation_result
        
        # Validate league data completeness
        required_fields = ['name', 'season', 'settings']
        for field in required_fields:
            has_field = field in league_info['league']
            validation_result['checks'][f'league_{field}'] = has_field
            
            if not has_field:
                validation_result['is_valid'] = False
                validation_result['issues'].append(f"Missing league field: {field}")
        
        # Validate roster data
        rosters = league_info.get('rosters', [])
        validation_result['checks']['has_rosters'] = len(rosters) > 0
        
        if not rosters:
            validation_result['is_valid'] = False
            validation_result['issues'].append("No roster data found")
        
        # Validate users data
        users = league_info.get('users', [])
        validation_result['checks']['has_users'] = len(users) > 0
        
        if not users:
            validation_result['is_valid'] = False
            validation_result['issues'].append("No user data found")
        
        logger.info(f"Validation result: {'PASS' if validation_result['is_valid'] else 'FAIL'}")
        return validation_result

def main():
    """Main execution function"""
    print("🏈 Sleeper API Sync System")
    print("=" * 50)
    
    # Initialize sync system
    sleeper_sync = SleeperAPISync()
    
    # Test league ID - user can replace with their own
    test_league_id = "1197631162923614208"  # Your Morts FF Dynasty league
    
    try:
        # 1. Validate API connectivity
        print("🔍 Validating Sleeper API connectivity...")
        validation = sleeper_sync.validate_sync_data(test_league_id)
        
        if not validation['is_valid']:
            print("❌ Validation failed:")
            for issue in validation['issues']:
                print(f"   - {issue}")
            return
        
        print("✅ API connectivity validated")
        
        # 2. Get all NFL players
        print("📋 Fetching NFL player database...")
        all_players = sleeper_sync.get_all_players()
        
        if all_players:
            print(f"✅ Loaded {len(all_players)} skill position players")
            
            # Show sample players by position
            for position in ['QB', 'RB', 'WR', 'TE']:
                pos_players = [p for p in all_players.values() if p['position'] == position]
                if pos_players:
                    print(f"   {position}: {len(pos_players)} players (e.g., {pos_players[0]['name']})")
        
        # 3. Comprehensive league sync
        print(f"🔄 Starting comprehensive sync for league: {test_league_id}")
        sync_result = sleeper_sync.sync_league_comprehensive(test_league_id)
        
        if sync_result['success']:
            print("✅ Comprehensive sync completed")
            
            # Display league info
            league_data = sync_result['data']['league']
            print(f"📊 League: {league_data['name']} ({league_data['season']})")
            print(f"   Teams: {league_data['total_rosters']}")
            print(f"   Scoring: {'PPR' if league_data.get('scoring_settings', {}).get('rec', 0) > 0 else 'Standard'}")
            
            # Display roster analysis
            roster_analysis = sync_result['data']['roster_analysis']
            print(f"\n🏆 TOP 5 TEAMS (by points):")
            sorted_teams = sorted(
                roster_analysis.items(),
                key=lambda x: x[1]['points_for'],
                reverse=True
            )
            
            for i, (roster_id, team_data) in enumerate(sorted_teams[:5]):
                record = f"{team_data['wins']}-{team_data['losses']}"
                print(f"   {i+1}. {team_data['owner']:20s} | {record:5s} | {team_data['points_for']:7.1f} PF")
            
            # Display current matchups if available
            matchups = sync_result['data'].get('current_matchups', [])
            if matchups:
                print(f"\n📅 CURRENT WEEK MATCHUPS ({len(matchups)} teams):")
                for matchup in matchups[:3]:  # Show first 3
                    points = matchup.get('points', 0)
                    print(f"   Roster {matchup.get('roster_id')}: {points:.1f} points")
            
        else:
            print("❌ Comprehensive sync failed:")
            for error in sync_result['errors']:
                print(f"   - {error}")
        
        # 4. Export data
        print("💾 Exporting sync data...")
        if sleeper_sync.export_sync_data():
            print("✅ Data exported to: /tmp/sleeper_sync_data.json")
        
        # 5. Demo real-time sync (brief)
        print("🔄 Testing real-time sync (30 seconds)...")
        sleeper_sync.start_real_time_sync(test_league_id, sync_interval=10)
        time.sleep(30)
        sleeper_sync.stop_real_time_sync()
        print("✅ Real-time sync test completed")
        
        print("\n🎯 Sleeper API Sync System Ready!")
        print("📋 Features available:")
        print("   ✓ League data synchronization")
        print("   ✓ Player database integration")  
        print("   ✓ Real-time matchup updates")
        print("   ✓ Transaction tracking")
        print("   ✓ Roster analysis")
        print("   ✓ Data validation and error handling")
        
    except KeyboardInterrupt:
        print("\n⏹️ Sync interrupted by user")
        sleeper_sync.stop_real_time_sync()
    
    except Exception as e:
        logger.error(f"Main execution failed: {e}")
        print(f"❌ System error: {e}")

if __name__ == "__main__":
    main()