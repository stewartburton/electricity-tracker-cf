async function globalTeardown() {
  console.log('🧹 Starting global test cleanup...');
  
  try {
    // Clean up test data if API helpers are available
    if (global.apiHelpers) {
      await global.apiHelpers.cleanupTestData();
      console.log('✅ Test data cleanup completed');
    } else {
      console.log('⚠️  No API helpers found for cleanup');
    }
    
    console.log('✅ Global teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error.message);
    console.error('Some test data may not have been cleaned up properly');
  }
}

module.exports = globalTeardown;