#!/usr/bin/env python3
"""
Rookie Data Pipeline Module
Handles file detection, polling, and real-time updates for rookie data across all modules.
Supports multi-year rookie classes (2025, 2026) with hot-reload capabilities.
"""

import os
import json
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from modules.rookie_database import RookieDatabase, RookiePlayer
from modules.rookie_heuristics_engine import get_rookie_heuristics_engine

class RookiePipeline:
    """
    Central pipeline for rookie data management across all modules.
    Provides file watching, real-time updates, and multi-year class support.
    """
    
    def __init__(self, base_directory: str = "backend/data/rookies"):
        self.base_directory = Path(base_directory)
        self.year_databases: Dict[str, RookieDatabase] = {}
        self.last_poll_time = {}
        self.file_checksums = {}
        self.current_year = "2025"
        self.future_year = "2026"
        
        # Initialize databases
        self._initialize_year_databases()
        self._scan_all_files()
    
    def _initialize_year_databases(self):
        """Initialize database instances for all available years"""
        if not self.base_directory.exists():
            print(f"⚠️ Base rookie directory not found: {self.base_directory}")
            return
        
        # Check for available years
        year_dirs = [d for d in self.base_directory.iterdir() if d.is_dir()]
        
        for year_dir in year_dirs:
            year = year_dir.name
            try:
                db_path = str(year_dir)
                self.year_databases[year] = RookieDatabase(db_path)
                self.last_poll_time[year] = time.time()
                print(f"✅ Initialized {year} rookie database")
            except Exception as e:
                print(f"❌ Failed to initialize {year} database: {e}")
    
    def _scan_all_files(self):
        """Scan all rookie files and store checksums for change detection"""
        for year, db in self.year_databases.items():
            year_path = Path(db.data_directory)
            if year_path.exists():
                self.file_checksums[year] = {}
                for json_file in year_path.glob("*.json"):
                    try:
                        with open(json_file, 'r') as f:
                            content = f.read()
                            self.file_checksums[year][json_file.name] = hash(content)
                    except Exception as e:
                        print(f"⚠️ Failed to scan {json_file}: {e}")
    
    def poll_for_updates(self, dev_mode: bool = True) -> Dict[str, List[str]]:
        """
        Poll for file updates. In dev mode, checks every 5 seconds.
        Returns dictionary of updated files by year.
        """
        if not dev_mode:
            return {}
        
        current_time = time.time()
        updated_files = {}
        
        for year, db in self.year_databases.items():
            # Check if 5 seconds have passed since last poll
            if current_time - self.last_poll_time[year] < 5:
                continue
            
            self.last_poll_time[year] = current_time
            year_updates = self._check_year_updates(year, db)
            
            if year_updates:
                updated_files[year] = year_updates
                # Reload database for this year
                self.year_databases[year] = RookieDatabase(str(db.data_directory))
                print(f"🔄 Reloaded {year} database - {len(year_updates)} files updated")
        
        return updated_files
    
    def _check_year_updates(self, year: str, db: RookieDatabase) -> List[str]:
        """Check for file updates in a specific year"""
        year_path = Path(db.data_directory)
        if not year_path.exists():
            return []
        
        updated_files = []
        current_files = {}
        
        # Scan current files
        for json_file in year_path.glob("*.json"):
            try:
                with open(json_file, 'r') as f:
                    content = f.read()
                    current_hash = hash(content)
                    current_files[json_file.name] = current_hash
                    
                    # Check if file is new or modified
                    old_hash = self.file_checksums.get(year, {}).get(json_file.name)
                    if old_hash != current_hash:
                        updated_files.append(json_file.name)
            except Exception as e:
                print(f"⚠️ Failed to check {json_file}: {e}")
        
        # Update checksums
        if year not in self.file_checksums:
            self.file_checksums[year] = {}
        self.file_checksums[year].update(current_files)
        
        return updated_files
    
    def get_current_rookies(self) -> List[RookiePlayer]:
        """Get current year rookies (2025)"""
        if self.current_year in self.year_databases:
            return self.year_databases[self.current_year].get_all_rookies()
        return []
    
    def get_future_rookies(self) -> List[RookiePlayer]:
        """Get future year rookies (2026)"""
        if self.future_year in self.year_databases:
            return self.year_databases[self.future_year].get_all_rookies()
        return []
    
    def get_rookies_by_year(self, year: str) -> List[RookiePlayer]:
        """Get rookies for specific year"""
        if year in self.year_databases:
            return self.year_databases[year].get_all_rookies()
        return []
    
    def get_all_available_years(self) -> List[str]:
        """Get list of all available rookie years"""
        return list(self.year_databases.keys())
    
    def get_rookies_for_rankings(self, year: str = None, position: str = None) -> List[Dict[str, Any]]:
        """
        Get rookies formatted for rankings module.
        Includes tier weighting based on draft capital, star rating, and ceiling summary.
        """
        if year is None:
            year = self.current_year
        
        rookies = self.get_rookies_by_year(year)
        if not rookies:
            return []
        
        formatted_rookies = []
        
        for rookie in rookies:
            # Filter by position if specified
            if position and rookie.position != position.upper():
                continue
            
            # Calculate tier weight
            tier_weight = self._calculate_tier_weight(rookie)
            
            rookie_data = {
                "player_id": f"rookie_{rookie.player_name.lower().replace(' ', '_')}",
                "name": rookie.player_name,
                "position": rookie.position,
                "team": rookie.nfl_team if rookie.nfl_team != "TBD" else "FA",
                "star_rating": rookie.star_rating,
                "dynasty_tier": rookie.dynasty_tier,
                "draft_capital": rookie.draft_capital,
                "tier_weight": tier_weight,
                "rookie_flag": True,
                "year": year,
                "context_notes": rookie.context_notes,
                "ceiling_summary": rookie.future_ceiling_summary,
                "athleticism": rookie.athleticism
            }
            
            formatted_rookies.append(rookie_data)
        
        # Sort by tier weight (higher is better)
        formatted_rookies.sort(key=lambda x: x['tier_weight'], reverse=True)
        
        return formatted_rookies
    
    def _calculate_tier_weight(self, rookie: RookiePlayer) -> float:
        """
        Calculate tier weight based on draft capital (heavy), star rating (medium), 
        and ceiling summary sentiment (light).
        """
        weight = 0.0
        
        # Draft capital weight (heavy - 50%)
        draft_weight = self._get_draft_capital_weight(rookie.draft_capital)
        weight += draft_weight * 0.5
        
        # Star rating weight (medium - 35%)
        star_weight = (rookie.star_rating / 5.0) * 100
        weight += star_weight * 0.35
        
        # Ceiling summary sentiment (light - 15%)
        ceiling_weight = self._analyze_ceiling_sentiment(rookie.future_ceiling_summary)
        weight += ceiling_weight * 0.15
        
        return round(weight, 2)
    
    def _get_draft_capital_weight(self, draft_capital: str) -> float:
        """Convert draft capital to weight (0-100)"""
        if "Round 1" in draft_capital:
            return 100.0
        elif "Round 2" in draft_capital:
            return 80.0
        elif "Round 3" in draft_capital:
            return 60.0
        elif "Round 4" in draft_capital:
            return 40.0
        elif "Round 5" in draft_capital:
            return 25.0
        elif "Round 6" in draft_capital:
            return 15.0
        elif "Round 7" in draft_capital:
            return 10.0
        elif "UDFA" in draft_capital:
            return 5.0
        else:
            return 50.0  # TBD/Unknown
    
    def _analyze_ceiling_sentiment(self, ceiling_summary: str) -> float:
        """Analyze ceiling summary for positive/negative sentiment (0-100)"""
        positive_keywords = [
            "elite", "wr1", "rb1", "qb1", "te1", "generational", "ceiling", 
            "upside", "potential", "star", "fantasy", "immediate", "top"
        ]
        
        negative_keywords = [
            "limited", "bust", "concerns", "risk", "inconsistent", 
            "depth", "bench", "backup", "replacement"
        ]
        
        summary_lower = ceiling_summary.lower()
        
        positive_count = sum(1 for word in positive_keywords if word in summary_lower)
        negative_count = sum(1 for word in negative_keywords if word in summary_lower)
        
        # Base score of 50, adjust based on sentiment
        sentiment_score = 50.0
        sentiment_score += (positive_count * 15) - (negative_count * 10)
        
        return max(0.0, min(100.0, sentiment_score))
    
    def get_pipeline_stats(self) -> Dict[str, Any]:
        """Get comprehensive pipeline statistics"""
        stats = {
            "available_years": list(self.year_databases.keys()),
            "current_year": self.current_year,
            "future_year": self.future_year,
            "total_rookies": 0,
            "by_year": {},
            "last_update": datetime.now().isoformat()
        }
        
        for year, db in self.year_databases.items():
            year_stats = db.get_database_stats()
            stats["by_year"][year] = year_stats
            stats["total_rookies"] += year_stats.get("total_rookies", 0)
        
        return stats

# Global pipeline instance
rookie_pipeline = RookiePipeline()

def get_rookie_pipeline() -> RookiePipeline:
    """Get global rookie pipeline instance"""
    return rookie_pipeline

if __name__ == "__main__":
    # Test pipeline functionality
    pipeline = RookiePipeline()
    stats = pipeline.get_pipeline_stats()
    
    print("🏈 ROOKIE DATA PIPELINE TEST")
    print("=" * 40)
    print(f"Available Years: {stats['available_years']}")
    print(f"Total Rookies: {stats['total_rookies']}")
    
    current_rookies = pipeline.get_current_rookies()
    print(f"\n📊 {pipeline.current_year} Rookies: {len(current_rookies)}")
    
    if current_rookies:
        formatted = pipeline.get_rookies_for_rankings()
        print("\n🏆 Top 3 by Tier Weight:")
        for i, rookie in enumerate(formatted[:3], 1):
            print(f"  {i}. {rookie['name']} ({rookie['position']}) - {rookie['tier_weight']}")