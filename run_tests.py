#!/usr/bin/env python3
"""
Test runner for On The Clock Flask modules
Comprehensive testing suite for all components
"""

import unittest
import sys
import os

def run_all_tests():
    """Run all unit tests for the Flask application"""
    print("🧪 Running On The Clock Test Suite...")
    
    # Discover and run all tests
    loader = unittest.TestLoader()
    start_dir = 'tests'
    suite = loader.discover(start_dir, pattern='test_*.py')
    
    # Run tests with verbose output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    tests_run = result.testsRun
    failures = len(result.failures)
    errors = len(result.errors)
    
    print(f"\n📊 Test Summary:")
    print(f"   Tests run: {tests_run}")
    print(f"   Failures: {failures}")
    print(f"   Errors: {errors}")
    
    if result.wasSuccessful():
        print("✅ All tests passed!")
        return 0
    else:
        print("❌ Some tests failed!")
        return 1

def run_specific_test(test_name):
    """Run a specific test module"""
    print(f"🎯 Running specific test: {test_name}")
    
    suite = unittest.TestLoader().loadTestsFromName(f'tests.{test_name}')
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return 0 if result.wasSuccessful() else 1

if __name__ == '__main__':
    if len(sys.argv) > 1:
        # Run specific test
        test_name = sys.argv[1]
        exit_code = run_specific_test(test_name)
    else:
        # Run all tests
        exit_code = run_all_tests()
    
    sys.exit(exit_code)