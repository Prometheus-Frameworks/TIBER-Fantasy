#!/usr/bin/env python3
"""
MySportsFeeds Service - NFL Data Integration
On The Clock Fantasy Football Analytics Platform

Provides real-time NFL data including injury reports, roster updates, and player statistics.
Integrates with existing Roster Shift Listener for automated monitoring.
"""

import os
import requests
import json
import base64
from datetime import datetime, date
from typing import Dict, List, Optional, Any
import time

class MySportsFeedsService:
    """
    MySportsFeeds API service for NFL data integration
    """
    
    def __init__(self):
        self.base_url = "https://api.mysportsfeeds.com/v2.1/pull/nfl"
        self.username = os.getenv('MSF_USERNAME')
        self.password = os.getenv('MSF_PASSWORD', 'MYSPORTSFEEDS')  # Default password
        
        if not self.username:
            print("⚠️ MSF_USERNAME not found - MySportsFeeds service will be disabled")
            self.enabled = False
        else:
            self.enabled = True
            print("✅ MySportsFeeds service initialized")
            
        # Authentication header
        if self.enabled:
            credentials = f"{self.username}:{self.password}"
            encoded_credentials = base64.b64encode(credentials.encode()).decode()
            self.headers = {
                'Authorization': f'Basic {encoded_credentials}',
                'Content-Type': 'application/json',
                'User-Agent': 'OnTheClock/1.0'
            }
    
    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make authenticated request to MySportsFeeds API"""
        if not self.enabled:
            return None
            
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = requests.get(url, headers=self.headers, params=params, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401:
                print(f"❌ Authentication failed - check MSF credentials")
                return None
            elif response.status_code == 403:
                print(f"❌ Access forbidden - check subscription status")
                return None
            else:
                print(f"❌ API request failed: {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error: {e}")
            return None
    
    def test_connection(self) -> Dict[str, Any]:
        """Test MySportsFeeds API connection and authentication"""
        if not self.enabled:
            return {
                'success': False,
                'error': 'Service disabled - MSF_USERNAME not configured'
            }
        
        # Test with current season games endpoint
        current_season = "2024-2025-regular"  # Current NFL season format
        test_endpoint = f"{current_season}/games.json"
        
        print(f"🔍 Testing MySportsFeeds connection...")
        result = self._make_request(test_endpoint)
        
        if result:
            games_count = len(result.get('games', []))
            return {
                'success': True,
                'message': f'Connection successful - found {games_count} games',
                'api_version': '2.1',
                'season': current_season,
                'games_available': games_count
            }
        else:
            return {
                'success': False,
                'error': 'Failed to connect to MySportsFeeds API'
            }
    
    def get_injury_reports(self, team: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get current NFL injury reports"""
        if not self.enabled:
            return []
        
        current_season = "2024-2025-regular"
        endpoint = f"{current_season}/injuries.json"
        
        params = {}
        if team:
            params['team'] = team.lower().replace(' ', '-')
        
        print(f"🏥 Fetching injury reports...")
        result = self._make_request(endpoint, params)
        
        if not result or 'players' not in result:
            return []
        
        injuries = []
        for player_data in result['players']:
            player = player_data.get('player', {})
            injury = player_data.get('injury', {})
            
            if injury:  # Only include players with active injuries
                injury_info = {
                    'player_name': f"{player.get('firstName', '')} {player.get('lastName', '')}".strip(),
                    'team': player.get('currentTeam', {}).get('abbreviation', ''),
                    'position': player.get('primaryPosition', ''),
                    'injury_description': injury.get('description', ''),
                    'injury_status': injury.get('status', ''),
                    'last_updated': datetime.now().isoformat(),
                    'source': 'MySportsFeeds'
                }
                injuries.append(injury_info)
        
        print(f"✅ Found {len(injuries)} active injuries")
        return injuries
    
    def get_roster_updates(self, team: Optional[str] = None, since_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get roster updates and player movements"""
        if not self.enabled:
            return []
        
        current_season = "2024-2025-regular"
        endpoint = f"{current_season}/roster_players.json"
        
        params = {}
        if team:
            params['team'] = team.lower().replace(' ', '-')
        
        print(f"👥 Fetching roster updates...")
        result = self._make_request(endpoint, params)
        
        if not result or 'rosters' not in result:
            return []
        
        roster_changes = []
        for roster_data in result['rosters']:
            team_info = roster_data.get('team', {})
            players = roster_data.get('players', [])
            
            for player_data in players:
                player = player_data.get('player', {})
                
                # Extract relevant roster information
                roster_info = {
                    'player_name': f"{player.get('firstName', '')} {player.get('lastName', '')}".strip(),
                    'team': team_info.get('abbreviation', ''),
                    'position': player.get('primaryPosition', ''),
                    'jersey_number': player.get('jerseyNumber'),
                    'status': 'active',  # MySportsFeeds shows active roster
                    'last_updated': datetime.now().isoformat(),
                    'source': 'MySportsFeeds'
                }
                roster_changes.append(roster_info)
        
        print(f"✅ Found {len(roster_changes)} roster entries")
        return roster_changes
    
    def get_player_stats(self, player_name: Optional[str] = None, position: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get cumulative player statistics for current season"""
        if not self.enabled:
            return []
        
        current_season = "2024-2025-regular"
        endpoint = f"{current_season}/cumulative_player_stats.json"
        
        params = {}
        if position:
            params['position'] = position.upper()
        
        print(f"📊 Fetching player statistics...")
        result = self._make_request(endpoint, params)
        
        if not result or 'playerStatsTotals' not in result:
            return []
        
        player_stats = []
        for stats_data in result['playerStatsTotals']:
            player = stats_data.get('player', {})
            stats = stats_data.get('stats', {})
            
            # Filter by player name if specified
            full_name = f"{player.get('firstName', '')} {player.get('lastName', '')}".strip()
            if player_name and player_name.lower() not in full_name.lower():
                continue
            
            # Extract fantasy-relevant stats
            receiving = stats.get('receiving', {})
            rushing = stats.get('rushing', {})
            passing = stats.get('passing', {})
            
            player_stat_info = {
                'player_name': full_name,
                'team': player.get('currentTeam', {}).get('abbreviation', ''),
                'position': player.get('primaryPosition', ''),
                'games_played': stats.get('gamesPlayed', 0),
                'receiving': {
                    'targets': receiving.get('targets', 0),
                    'receptions': receiving.get('receptions', 0),
                    'yards': receiving.get('recYards', 0),
                    'touchdowns': receiving.get('recTD', 0)
                },
                'rushing': {
                    'attempts': rushing.get('rushAttempts', 0),
                    'yards': rushing.get('rushYards', 0),
                    'touchdowns': rushing.get('rushTD', 0)
                },
                'passing': {
                    'attempts': passing.get('passAttempts', 0),
                    'completions': passing.get('passCompletions', 0),
                    'yards': passing.get('passYards', 0),
                    'touchdowns': passing.get('passTD', 0),
                    'interceptions': passing.get('passInt', 0)
                },
                'last_updated': datetime.now().isoformat(),
                'source': 'MySportsFeeds'
            }
            player_stats.append(player_stat_info)
        
        print(f"✅ Found stats for {len(player_stats)} players")
        return player_stats
    
    def get_weekly_game_logs(self, week: int, player_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get player game logs for specific week"""
        if not self.enabled:
            return []
        
        current_season = "2024-2025-regular"
        endpoint = f"{current_season}/week/{week}/player_gamelogs.json"
        
        print(f"📈 Fetching week {week} game logs...")
        result = self._make_request(endpoint)
        
        if not result or 'gamelogs' not in result:
            return []
        
        game_logs = []
        for gamelog_data in result['gamelogs']:
            player = gamelog_data.get('player', {})
            stats = gamelog_data.get('stats', {})
            game = gamelog_data.get('game', {})
            
            # Filter by player name if specified
            full_name = f"{player.get('firstName', '')} {player.get('lastName', '')}".strip()
            if player_name and player_name.lower() not in full_name.lower():
                continue
            
            # Extract game log information
            receiving = stats.get('receiving', {})
            rushing = stats.get('rushing', {})
            
            game_log_info = {
                'player_name': full_name,
                'team': player.get('currentTeam', {}).get('abbreviation', ''),
                'position': player.get('primaryPosition', ''),
                'week': week,
                'game_date': game.get('startTime', ''),
                'opponent': game.get('awayTeam', {}).get('abbreviation', '') if game.get('homeTeam', {}).get('abbreviation', '') == player.get('currentTeam', {}).get('abbreviation', '') else game.get('homeTeam', {}).get('abbreviation', ''),
                'receiving': {
                    'targets': receiving.get('targets', 0),
                    'receptions': receiving.get('receptions', 0),
                    'yards': receiving.get('recYards', 0),
                    'touchdowns': receiving.get('recTD', 0)
                },
                'rushing': {
                    'attempts': rushing.get('rushAttempts', 0),
                    'yards': rushing.get('rushYards', 0),
                    'touchdowns': rushing.get('rushTD', 0)
                },
                'last_updated': datetime.now().isoformat(),
                'source': 'MySportsFeeds'
            }
            game_logs.append(game_log_info)
        
        print(f"✅ Found {len(game_logs)} game logs for week {week}")
        return game_logs
    
    def get_comprehensive_update(self) -> Dict[str, Any]:
        """Get comprehensive update including injuries, rosters, and key stats"""
        if not self.enabled:
            return {'error': 'Service not enabled'}
        
        print(f"🔄 Fetching comprehensive MySportsFeeds update...")
        
        # Get all key data
        injuries = self.get_injury_reports()
        qb_stats = self.get_player_stats(position='QB')
        rb_stats = self.get_player_stats(position='RB') 
        wr_stats = self.get_player_stats(position='WR')
        te_stats = self.get_player_stats(position='TE')
        
        comprehensive_data = {
            'timestamp': datetime.now().isoformat(),
            'injuries': injuries,
            'player_stats': {
                'QB': qb_stats[:10],  # Top 10 by position
                'RB': rb_stats[:20],  # Top 20 RBs
                'WR': wr_stats[:30],  # Top 30 WRs  
                'TE': te_stats[:15]   # Top 15 TEs
            },
            'summary': {
                'total_injuries': len(injuries),
                'total_players': len(qb_stats) + len(rb_stats) + len(wr_stats) + len(te_stats),
                'last_updated': datetime.now().isoformat()
            }
        }
        
        print(f"✅ Comprehensive update complete - {len(injuries)} injuries, {comprehensive_data['summary']['total_players']} players")
        return comprehensive_data

# Initialize service instance
mysportsfeeds_service = MySportsFeedsService()

def get_mysportsfeeds_service():
    """Get MySportsFeeds service instance"""
    return mysportsfeeds_service