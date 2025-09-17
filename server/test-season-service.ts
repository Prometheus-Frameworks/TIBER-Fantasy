/**
 * Quick test script to verify SeasonService implementation
 */

import { seasonService } from './services/SeasonService';

async function testSeasonService() {
  console.log('🧪 Testing SeasonService implementation...');
  
  try {
    // Test the current() method with hierarchical detection
    console.log('📅 Testing current() method...');
    const current = await seasonService.current();
    console.log('✅ Current season/week detected:', current);
    
    // Test cache clearing
    console.log('🧽 Testing cache clearing...');
    seasonService.clearCache();
    console.log('✅ Cache cleared successfully');
    
    // Test getting latest persisted state
    console.log('💾 Testing latest persisted state...');
    const persisted = await seasonService.getLatestPersistedState();
    console.log('✅ Latest persisted state:', persisted || 'No persisted state found');
    
    console.log('🎉 SeasonService tests completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ SeasonService test failed:', error);
    return false;
  }
}

// Export for potential use in other test files
export { testSeasonService };

// Run test if called directly
if (require.main === module) {
  testSeasonService()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}