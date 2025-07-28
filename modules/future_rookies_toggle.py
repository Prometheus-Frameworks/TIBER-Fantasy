#!/usr/bin/env python3
"""
Future Rookies UI Toggle Module
Handles toggling between current NFL rookies (2025) and future prospects (2026+).
Uses folder paths to distinguish between current and future rookie classes.
"""

import os
from typing import Dict, List, Any, Optional
from pathlib import Path
from modules.rookie_pipeline import get_rookie_pipeline
from modules.rookie_database import RookieDatabase

class FutureRookiesToggle:
    """
    Manages UI toggle between current and future rookie classes.
    Supports dynamic folder detection and seamless switching.
    """
    
    def __init__(self):
        self.pipeline = get_rookie_pipeline()
        self.base_directory = Path("backend/data/rookies")
        self.current_year = "2025"
        self.future_years = []
        self.year_databases = {}
        
        self._scan_available_years()
        self._initialize_future_databases()
    
    def _scan_available_years(self):
        """Scan for available rookie year directories"""
        if not self.base_directory.exists():
            print(f"⚠️ Base rookie directory not found: {self.base_directory}")
            return
        
        year_dirs = [d for d in self.base_directory.iterdir() if d.is_dir()]
        available_years = [d.name for d in year_dirs if d.name.isdigit()]
        
        # Separate current vs future years
        current_year_int = int(self.current_year)
        self.future_years = [year for year in available_years if int(year) > current_year_int]
        
        print(f"📅 Available years: {available_years}")
        print(f"🎯 Current year: {self.current_year}")
        print(f"🔮 Future years: {self.future_years}")
    
    def _initialize_future_databases(self):
        """Initialize databases for future rookie years"""
        for year in self.future_years:
            try:
                year_path = self.base_directory / year
                if year_path.exists():
                    self.year_databases[year] = RookieDatabase(str(year_path))
                    print(f"✅ Initialized {year} future database")
            except Exception as e:
                print(f"❌ Failed to initialize {year} database: {e}")
    
    def get_current_rookies(self, position: str = None) -> Dict[str, Any]:
        """Get current year rookies (2025)"""
        try:
            rookies = self.pipeline.get_rookies_for_rankings(
                year=self.current_year, 
                position=position
            )
            
            return {
                'success': True,
                'year': self.current_year,
                'year_type': 'current',
                'position_filter': position,
                'total_rookies': len(rookies),
                'rookies': rookies,
                'data_source': f"/backend/data/rookies/{self.current_year}/"
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to load current rookies: {str(e)}'
            }
    
    def get_future_rookies(self, year: str = None, position: str = None) -> Dict[str, Any]:
        """Get future year rookies (2026+)"""
        try:
            # Use first available future year if none specified
            if year is None:
                if not self.future_years:
                    return {
                        'success': False,
                        'error': 'No future rookie years available',
                        'available_future_years': []
                    }
                year = self.future_years[0]
            
            # Check if year is actually future
            if year not in self.future_years:
                return {
                    'success': False,
                    'error': f'Year {year} is not a future year',
                    'available_future_years': self.future_years
                }
            
            # Get rookies from future database
            if year in self.year_databases:
                db = self.year_databases[year]
                all_rookies = db.get_all_rookies()
                
                # Filter by position if specified
                if position:
                    filtered_rookies = [r for r in all_rookies if r.position == position.upper()]
                else:
                    filtered_rookies = all_rookies
                
                # Convert to standard format
                rookies_data = []
                for rookie in filtered_rookies:
                    rookie_dict = {
                        'player_name': rookie.player_name,
                        'position': rookie.position,
                        'nfl_team': rookie.nfl_team,
                        'draft_capital': rookie.draft_capital,
                        'star_rating': rookie.star_rating,
                        'dynasty_tier': rookie.dynasty_tier,
                        'rookie_flag': True,
                        'year': year,
                        'context_notes': rookie.context_notes,
                        'ceiling_summary': rookie.future_ceiling_summary,
                        'athleticism': rookie.athleticism,
                        'future_prospect': True
                    }
                    rookies_data.append(rookie_dict)
                
                return {
                    'success': True,
                    'year': year,
                    'year_type': 'future',
                    'position_filter': position,
                    'total_rookies': len(rookies_data),
                    'rookies': rookies_data,
                    'data_source': f"/backend/data/rookies/{year}/",
                    'placeholder_ready': True
                }
            else:
                return {
                    'success': False,
                    'error': f'Database not found for year {year}',
                    'placeholder_ready': True
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to load future rookies: {str(e)}'
            }
    
    def toggle_rookie_class(self, target_year: str, position: str = None) -> Dict[str, Any]:
        """
        Toggle to specific rookie class (current or future).
        Main toggle function for UI switching.
        """
        current_year_int = int(self.current_year)
        target_year_int = int(target_year) if target_year.isdigit() else current_year_int
        
        if target_year_int <= current_year_int:
            # Current or past year - use current rookies
            return self.get_current_rookies(position)
        else:
            # Future year - use future rookies
            return self.get_future_rookies(target_year, position)
    
    def get_available_years(self) -> Dict[str, Any]:
        """Get all available rookie years for toggle UI"""
        try:
            current_stats = self.pipeline.get_pipeline_stats()
            
            # Get future year stats
            future_stats = {}
            for year in self.future_years:
                if year in self.year_databases:
                    db_stats = self.year_databases[year].get_database_stats()
                    future_stats[year] = db_stats
                else:
                    future_stats[year] = {
                        'total_rookies': 0,
                        'placeholder_ready': True
                    }
            
            return {
                'success': True,
                'current_year': self.current_year,
                'future_years': self.future_years,
                'all_available_years': [self.current_year] + self.future_years,
                'current_stats': current_stats,
                'future_stats': future_stats,
                'toggle_ready': True
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to get available years: {str(e)}'
            }
    
    def get_year_comparison(self) -> Dict[str, Any]:
        """Compare rookie classes across different years"""
        try:
            comparison = {
                'current_year': {
                    'year': self.current_year,
                    'type': 'current',
                    'rookies': len(self.pipeline.get_current_rookies()),
                    'data_available': True
                },
                'future_years': {}
            }
            
            for year in self.future_years:
                if year in self.year_databases:
                    future_rookies = self.year_databases[year].get_all_rookies()
                    comparison['future_years'][year] = {
                        'year': year,
                        'type': 'future',
                        'rookies': len(future_rookies),
                        'data_available': True,
                        'placeholder_ready': True
                    }
                else:
                    comparison['future_years'][year] = {
                        'year': year,
                        'type': 'future',
                        'rookies': 0,
                        'data_available': False,
                        'placeholder_ready': True
                    }
            
            return {
                'success': True,
                'comparison': comparison,
                'total_years': 1 + len(self.future_years)
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Year comparison failed: {str(e)}'
            }
    
    def create_future_year_placeholder(self, year: str) -> Dict[str, Any]:
        """Create placeholder structure for future rookie year"""
        try:
            year_path = self.base_directory / year
            year_path.mkdir(exist_ok=True)
            
            # Create placeholder README
            readme_path = year_path / "README.md"
            with open(readme_path, 'w') as f:
                f.write(f"# {year} Rookie Class\n\n")
                f.write("Placeholder directory for future rookie prospects.\n")
                f.write("Add rookie JSON files here when data becomes available.\n")
            
            # Update available years
            self._scan_available_years()
            self._initialize_future_databases()
            
            return {
                'success': True,
                'message': f'Created placeholder for {year} rookie class',
                'directory': str(year_path),
                'placeholder_ready': True
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to create placeholder: {str(e)}'
            }

# Global toggle instance
future_rookies_toggle = FutureRookiesToggle()

def get_future_rookies_toggle() -> FutureRookiesToggle:
    """Get global future rookies toggle instance"""
    return future_rookies_toggle

if __name__ == "__main__":
    # Test future rookies toggle
    toggle = FutureRookiesToggle()
    
    print("🔮 FUTURE ROOKIES TOGGLE TEST")
    print("=" * 40)
    
    # Test available years
    years_info = toggle.get_available_years()
    if years_info['success']:
        print(f"Current Year: {years_info['current_year']}")
        print(f"Future Years: {years_info['future_years']}")
    
    # Test current rookies
    current = toggle.get_current_rookies()
    if current['success']:
        print(f"\n📊 {current['year']} Rookies: {current['total_rookies']}")
    
    # Test future rookies (if available)
    if toggle.future_years:
        future = toggle.get_future_rookies()
        if future['success']:
            print(f"📅 {future['year']} Future Rookies: {future['total_rookies']}")
        else:
            print(f"⚠️ Future rookies: {future['error']}")
    else:
        print("📅 No future rookie years detected")