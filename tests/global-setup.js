const { ApiHelpers } = require('./utils/api-helpers');

async function globalSetup() {
  console.log('🚀 Starting global test setup...');
  
  const apiHelpers = new ApiHelpers();
  
  try {
    // Health check to ensure the application is running
    const health = await apiHelpers.healthCheck();
    console.log('✅ Application health check passed:', health.status);
    
    // Store API helpers instance for cleanup
    global.apiHelpers = apiHelpers;
    
    console.log('✅ Global setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error.message);
    console.error('Please ensure the application is running at:', apiHelpers.baseURL);
    process.exit(1);
  }
}

module.exports = globalSetup;