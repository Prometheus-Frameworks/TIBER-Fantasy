#!/usr/bin/env python3
"""
Test script to verify Flask modular structure
Run this to validate the reorganized architecture
"""

import os
import sys
import importlib.util

def test_flask_structure():
    """Test the complete Flask modular structure"""
    print("🔍 Testing Flask Structure...")
    
    # Test 1: Check directory structure
    print("\n1. Checking directory structure...")
    required_dirs = ['modules', 'data', 'templates', 'static']
    for dir_name in required_dirs:
        if os.path.exists(dir_name):
            print(f"   ✅ {dir_name}/ exists")
        else:
            print(f"   ❌ {dir_name}/ missing")
    
    # Test 2: Check core files
    print("\n2. Checking core files...")
    required_files = [
        'app.py',
        'flask_requirements.txt',
        'modules/__init__.py',
        'modules/rankings_engine.py',
        'modules/wr_ratings_processor.py', 
        'modules/rookie_database.py',
        'modules/vorp_calculator.py',
        'templates/base.html',
        'templates/index.html',
        'templates/rankings.html',
        'static/css/style.css',
        'static/js/app.js'
    ]
    
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"   ✅ {file_path}")
        else:
            print(f"   ❌ {file_path} missing")
    
    # Test 3: Check data files
    print("\n3. Checking data files...")
    data_files = [
        'data/rookies.json',
        'data/WR_2024_Ratings_With_Tags.csv'
    ]
    
    for file_path in data_files:
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            print(f"   ✅ {file_path} ({size} bytes)")
        else:
            print(f"   ❌ {file_path} missing")
    
    # Test 4: Test module imports
    print("\n4. Testing module imports...")
    try:
        sys.path.append('modules')
        
        # Test each module can be imported
        modules_to_test = [
            'rankings_engine',
            'wr_ratings_processor',
            'rookie_database', 
            'vorp_calculator'
        ]
        
        for module_name in modules_to_test:
            try:
                spec = importlib.util.spec_from_file_location(
                    module_name, 
                    f"modules/{module_name}.py"
                )
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                print(f"   ✅ {module_name} imports successfully")
            except Exception as e:
                print(f"   ❌ {module_name} import failed: {str(e)}")
                
    except Exception as e:
        print(f"   ❌ Module import test failed: {str(e)}")
    
    # Test 5: Check Flask app structure
    print("\n5. Testing Flask app structure...")
    try:
        with open('app.py', 'r') as f:
            app_content = f.read()
            
        required_patterns = [
            'from flask import Flask',
            'from modules.rankings_engine import RankingsEngine',
            'from modules.wr_ratings_processor import WRRatingsProcessor',
            'from modules.rookie_database import RookieDatabase',
            'from modules.vorp_calculator import VORPCalculator',
            '@app.route(\'/\')',
            '@app.route(\'/rankings\')',
            '@app.route(\'/api/rankings\')',
            '@app.route(\'/api/wr-ratings\')',
            '@app.route(\'/api/rookies\')'
        ]
        
        for pattern in required_patterns:
            if pattern in app_content:
                print(f"   ✅ Found: {pattern}")
            else:
                print(f"   ❌ Missing: {pattern}")
                
    except Exception as e:
        print(f"   ❌ Flask app structure test failed: {str(e)}")
    
    print("\n🏆 Flask structure test complete!")
    print("\n📋 Next steps:")
    print("   1. Install dependencies: pip install -r flask_requirements.txt")
    print("   2. Run application: python app.py")
    print("   3. Open browser to: http://localhost:5000")

if __name__ == "__main__":
    test_flask_structure()