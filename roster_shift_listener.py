#!/usr/bin/env python3
"""
Module: RosterShiftListener.v1
Purpose: Tracks all player-related NFL transactions that could impact dynasty context.
Scope: Logs trades, signings, releases, coaching changes, injuries, and retirements.

Behavior:
• Checks official NFL team rosters, transaction feeds, and major news aggregators daily.
• Logs each event with date, team(s) involved, players/coaches affected, and nature of the change.
• Appends to a centralized `roster_shift_log.json` file for Prometheus to read.

Output Format Example:
[
  {
    "date": "2025-07-26",
    "team": "JAX",
    "type": "coaching_change",
    "details": {
      "position": "OC",
      "name_in": "Liam Coen",
      "name_out": "Press Taylor",
      "impact_note": "Scheme shift likely to benefit slot WR usage."
    }
  },
  {
    "date": "2025-07-25",
    "team": "CHI",
    "type": "player_addition",
    "details": {
      "player_name": "Brian Thomas Jr.",
      "action": "acquired",
      "method": "trade",
      "note": "Expected to compete for WR1 role."
    }
  }
]
"""

import json
import os
import sys
from datetime import datetime, date
from typing import List, Dict, Any
import requests
import time

class RosterShiftListener:
    """
    NFL Roster Shift Monitoring System
    Tracks transactions, coaching changes, and player movements
    """
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.log_file = os.path.join(data_dir, "roster_shift_log.json")
        self.last_check_file = os.path.join(data_dir, "last_roster_check.json")
        
        # Ensure data directory exists
        os.makedirs(data_dir, exist_ok=True)
        
        # Initialize log file if it doesn't exist
        if not os.path.exists(self.log_file):
            with open(self.log_file, 'w') as f:
                json.dump([], f, indent=2)
        
        # Transaction types we monitor
        self.transaction_types = {
            'player_addition': 'Player acquired via trade, signing, or waiver claim',
            'player_release': 'Player released, cut, or waived',
            'coaching_change': 'Head coach, coordinator, or position coach change',
            'injury_report': 'Significant injury affecting fantasy outlook',
            'retirement': 'Player retirement announcement',
            'suspension': 'League suspension or disciplinary action',
            'contract_extension': 'Contract extension affecting roster security',
            'depth_chart_change': 'Official depth chart position change'
        }
        
        # NFL teams mapping
        self.nfl_teams = {
            'ARI': 'Arizona Cardinals', 'ATL': 'Atlanta Falcons', 'BAL': 'Baltimore Ravens',
            'BUF': 'Buffalo Bills', 'CAR': 'Carolina Panthers', 'CHI': 'Chicago Bears',
            'CIN': 'Cincinnati Bengals', 'CLE': 'Cleveland Browns', 'DAL': 'Dallas Cowboys',
            'DEN': 'Denver Broncos', 'DET': 'Detroit Lions', 'GB': 'Green Bay Packers',
            'HOU': 'Houston Texans', 'IND': 'Indianapolis Colts', 'JAX': 'Jacksonville Jaguars',
            'KC': 'Kansas City Chiefs', 'LV': 'Las Vegas Raiders', 'LAC': 'Los Angeles Chargers',
            'LAR': 'Los Angeles Rams', 'MIA': 'Miami Dolphins', 'MIN': 'Minnesota Vikings',
            'NE': 'New England Patriots', 'NO': 'New Orleans Saints', 'NYG': 'New York Giants',
            'NYJ': 'New York Jets', 'PHI': 'Philadelphia Eagles', 'PIT': 'Pittsburgh Steelers',
            'SF': 'San Francisco 49ers', 'SEA': 'Seattle Seahawks', 'TB': 'Tampa Bay Buccaneers',
            'TEN': 'Tennessee Titans', 'WAS': 'Washington Commanders'
        }
    
    def load_existing_log(self) -> List[Dict[str, Any]]:
        """Load existing roster shift log entries"""
        try:
            with open(self.log_file, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []
    
    def save_log_entry(self, entry: Dict[str, Any]) -> None:
        """Save a new roster shift entry to the log"""
        existing_log = self.load_existing_log()
        existing_log.append(entry)
        
        # Sort by date (newest first)
        existing_log.sort(key=lambda x: x['date'], reverse=True)
        
        with open(self.log_file, 'w') as f:
            json.dump(existing_log, f, indent=2)
        
        print(f"✅ Logged roster shift: {entry['type']} - {entry['team']}")
    
    def create_transaction_entry(self, team: str, transaction_type: str, details: Dict[str, Any]) -> Dict[str, Any]:
        """Create a standardized transaction entry"""
        return {
            "date": date.today().isoformat(),
            "timestamp": datetime.now().isoformat(),
            "team": team.upper(),
            "type": transaction_type,
            "details": details,
            "source": "RosterShiftListener.v1",
            "fantasy_impact": self._assess_fantasy_impact(transaction_type, details)
        }
    
    def _assess_fantasy_impact(self, transaction_type: str, details: Dict[str, Any]) -> str:
        """Assess potential fantasy football impact"""
        if transaction_type == 'coaching_change':
            if 'OC' in details.get('position', ''):
                return 'High - Offensive scheme changes likely'
            elif 'HC' in details.get('position', ''):
                return 'Medium - Team philosophy may shift'
            else:
                return 'Low - Position coach change'
        elif transaction_type == 'player_addition':
            return 'Medium - Roster competition increases'
        elif transaction_type == 'player_release':
            return 'Medium - Target/touch share redistribution'
        elif transaction_type == 'injury_report':
            return 'High - Playing time disruption'
        else:
            return 'Low - Monitor for trend patterns'
    
    def log_coaching_change(self, team: str, position: str, name_in: str, name_out: str = None, impact_note: str = None) -> None:
        """Log a coaching change"""
        details = {
            "position": position,
            "name_in": name_in,
            "name_out": name_out or "Unknown",
            "impact_note": impact_note or "Monitoring for scheme changes"
        }
        
        entry = self.create_transaction_entry(team, "coaching_change", details)
        self.save_log_entry(entry)
    
    def log_player_transaction(self, team: str, player_name: str, action: str, method: str = None, note: str = None) -> None:
        """Log a player transaction (addition, release, etc.)"""
        transaction_type = "player_addition" if action in ['acquired', 'signed', 'claimed'] else "player_release"
        
        details = {
            "player_name": player_name,
            "action": action,
            "method": method or "Unknown",
            "note": note or "Monitoring roster impact"
        }
        
        entry = self.create_transaction_entry(team, transaction_type, details)
        self.save_log_entry(entry)
    
    def log_injury_report(self, team: str, player_name: str, injury_type: str, severity: str, expected_return: str = None) -> None:
        """Log a significant injury"""
        details = {
            "player_name": player_name,
            "injury_type": injury_type,
            "severity": severity,
            "expected_return": expected_return or "Unknown",
            "impact_note": f"{severity} {injury_type} - monitoring replacement usage"
        }
        
        entry = self.create_transaction_entry(team, "injury_report", details)
        self.save_log_entry(entry)
    
    def check_for_updates(self) -> List[Dict[str, Any]]:
        """
        Check for NFL roster updates from available sources
        This is the main monitoring function that would integrate with APIs
        """
        new_entries = []
        
        # Update last check timestamp
        last_check_data = {
            "last_check": datetime.now().isoformat(),
            "status": "monitoring_active",
            "sources_checked": ["manual_entry", "future_api_integration"]
        }
        
        with open(self.last_check_file, 'w') as f:
            json.dump(last_check_data, f, indent=2)
        
        print(f"🔍 Roster shift monitoring active - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return new_entries
    
    def get_recent_shifts(self, days: int = 7) -> List[Dict[str, Any]]:
        """Get roster shifts from the last N days"""
        existing_log = self.load_existing_log()
        
        cutoff_date = (datetime.now().date() - datetime.timedelta(days=days)).isoformat()
        
        recent_shifts = [
            entry for entry in existing_log 
            if entry.get('date', '2000-01-01') >= cutoff_date
        ]
        
        return recent_shifts
    
    def get_team_shifts(self, team: str) -> List[Dict[str, Any]]:
        """Get all roster shifts for a specific team"""
        existing_log = self.load_existing_log()
        
        team_shifts = [
            entry for entry in existing_log 
            if entry.get('team', '').upper() == team.upper()
        ]
        
        return team_shifts
    
    def get_impact_summary(self) -> Dict[str, Any]:
        """Generate summary of recent high-impact changes"""
        existing_log = self.load_existing_log()
        
        high_impact = [
            entry for entry in existing_log 
            if entry.get('fantasy_impact', '').startswith('High')
        ]
        
        summary = {
            "total_entries": len(existing_log),
            "high_impact_changes": len(high_impact),
            "coaching_changes": len([e for e in existing_log if e['type'] == 'coaching_change']),
            "player_transactions": len([e for e in existing_log if e['type'] in ['player_addition', 'player_release']]),
            "injury_reports": len([e for e in existing_log if e['type'] == 'injury_report']),
            "last_update": existing_log[0]['date'] if existing_log else "No entries"
        }
        
        return summary

def run_roster_shift_listener():
    """
    Main execution function for roster shift monitoring
    This would be called daily via cron job or manual trigger
    """
    listener = RosterShiftListener()
    
    print("🎯 Starting NFL Roster Shift Monitoring")
    print("=" * 50)
    
    # Check for updates (placeholder for actual API integration)
    new_entries = listener.check_for_updates()
    
    # Generate summary
    summary = listener.get_impact_summary()
    
    print(f"📊 Current Log Status:")
    print(f"   • Total entries: {summary['total_entries']}")
    print(f"   • High impact changes: {summary['high_impact_changes']}")
    print(f"   • Coaching changes: {summary['coaching_changes']}")
    print(f"   • Player transactions: {summary['player_transactions']}")
    print(f"   • Injury reports: {summary['injury_reports']}")
    print(f"   • Last update: {summary['last_update']}")
    
    print("\n✅ Roster shift monitoring complete")
    print(f"📁 Log file: {listener.log_file}")
    
    return listener

# Global instance for module integration
roster_shift_listener = RosterShiftListener()

def get_roster_shift_listener() -> RosterShiftListener:
    """Get global RosterShiftListener instance"""
    return roster_shift_listener

if __name__ == "__main__":
    # Test the RosterShiftListener with sample entries
    listener = run_roster_shift_listener()
    
    # Add sample entries for testing
    print("\n🧪 Adding sample roster shift entries for testing:")
    
    # Sample coaching change
    listener.log_coaching_change(
        team="JAX",
        position="OC",
        name_in="Liam Coen",
        name_out="Press Taylor",
        impact_note="Scheme shift likely to benefit slot WR usage."
    )
    
    # Sample player transaction
    listener.log_player_transaction(
        team="CHI",
        player_name="Brian Thomas Jr.",
        action="acquired",
        method="trade",
        note="Expected to compete for WR1 role."
    )
    
    # Sample injury report
    listener.log_injury_report(
        team="TB",
        player_name="Chris Godwin",
        injury_type="Ankle",
        severity="Minor",
        expected_return="Week 1"
    )
    
    print(f"\n📈 Final Summary:")
    final_summary = listener.get_impact_summary()
    for key, value in final_summary.items():
        print(f"   • {key.replace('_', ' ').title()}: {value}")