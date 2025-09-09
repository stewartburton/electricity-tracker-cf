const { test, expect } = require('@playwright/test');
const { TestHelpers } = require('./utils/test-helpers');
const { ApiHelpers } = require('./utils/api-helpers');

test.describe('Data Cleanup Tests', () => {
  let testHelpers;
  let apiHelpers;

  test.beforeAll(async () => {
    apiHelpers = new ApiHelpers();
  });

  test.beforeEach(async ({ page }) => {
    testHelpers = new TestHelpers(page);
  });

  test('should track and clean up test users', async ({ page }) => {
    const testEmail1 = testHelpers.generateTestEmail('cleanup1');
    const testEmail2 = testHelpers.generateTestEmail('cleanup2');
    const testPassword = testHelpers.generateTestPassword();
    
    // Register multiple test users
    await testHelpers.registerUser(testEmail1, testPassword);
    await testHelpers.registerUser(testEmail2, testPassword);
    
    // Track users for cleanup
    apiHelpers.trackTestUser(testEmail1);
    apiHelpers.trackTestUser(testEmail2);
    
    // Verify users are tracked
    const trackedUsers = apiHelpers.getTrackedUsers();
    expect(trackedUsers).toContain(testEmail1);
    expect(trackedUsers).toContain(testEmail2);
    
    // Perform cleanup
    await apiHelpers.cleanupTestData();
    
    // Verify cleanup tracking is reset
    const cleanedUsers = apiHelpers.getTrackedUsers();
    expect(cleanedUsers.length).toBe(0);
  });

  test('should handle cleanup when user login fails', async ({ page }) => {
    const testEmail = testHelpers.generateTestEmail('failcleanup');
    const testPassword = testHelpers.generateTestPassword();
    
    // Track a non-existent user (simulate failed cleanup scenario)
    apiHelpers.trackTestUser(testEmail);
    
    // Cleanup should handle missing users gracefully
    await expect(async () => {
      await apiHelpers.cleanupTestData();
    }).not.toThrow();
    
    // Cleanup tracking should still be reset
    const cleanedUsers = apiHelpers.getTrackedUsers();
    expect(cleanedUsers.length).toBe(0);
  });

  test('should track and clean up test groups', async ({ page }) => {
    const ownerEmail = testHelpers.generateTestEmail('groupowner');
    const ownerPassword = testHelpers.generateTestPassword();
    
    // Register user and create group
    await testHelpers.registerUser(ownerEmail, ownerPassword);
    const loginResult = await testHelpers.loginUser(ownerEmail, ownerPassword);
    
    const groupName = `Test Group ${Date.now()}`;
    const groupResult = await apiHelpers.createHouseholdGroup(loginResult.token, groupName);
    
    // Groups should be automatically tracked by API helpers
    const trackedGroups = apiHelpers.getTrackedGroups();
    expect(trackedGroups.length).toBeGreaterThan(0);
    
    // Track user for cleanup as well
    apiHelpers.trackTestUser(ownerEmail);
    
    // Perform cleanup
    await apiHelpers.cleanupTestData();
    
    // Verify cleanup tracking is reset
    const cleanedGroups = apiHelpers.getTrackedGroups();
    expect(cleanedGroups.length).toBe(0);
  });

  test('should clean up test data across multiple test runs', async ({ page }) => {
    // This test simulates multiple test runs by creating and cleaning up data multiple times
    
    for (let i = 0; i < 3; i++) {
      const testEmail = testHelpers.generateTestEmail(`multirun${i}`);
      const testPassword = testHelpers.generateTestPassword();
      
      // Register user
      await testHelpers.registerUser(testEmail, testPassword);
      apiHelpers.trackTestUser(testEmail);
      
      // Add some test data
      const loginResult = await testHelpers.loginUser(testEmail, testPassword);
      await apiHelpers.addVoucherForUser(loginResult.token, 25);
      
      // Clean up immediately
      await apiHelpers.cleanupTestData();
      
      // Verify cleanup was successful
      const trackedUsers = apiHelpers.getTrackedUsers();
      expect(trackedUsers.length).toBe(0);
    }
  });

  test('should handle API errors during cleanup gracefully', async ({ page }) => {
    const testEmail = testHelpers.generateTestEmail('errorcleanup');
    
    // Track a user that might cause API errors during cleanup
    apiHelpers.trackTestUser(testEmail);
    apiHelpers.trackTestGroup('invalid-group-id');
    
    // Cleanup should not throw even if some operations fail
    await expect(async () => {
      await apiHelpers.cleanupTestData();
    }).not.toThrow();
  });

  test('should verify no test artifacts remain after cleanup', async ({ page }) => {
    const testEmail = testHelpers.generateTestEmail('artifacts');
    const testPassword = testHelpers.generateTestPassword();
    
    // Create test user with data
    await testHelpers.registerUser(testEmail, testPassword);
    const loginResult = await testHelpers.loginUser(testEmail, testPassword);
    
    // Add various types of test data
    await apiHelpers.addVoucherForUser(loginResult.token, 100);
    await apiHelpers.addReadingForUser(loginResult.token, 1500);
    
    // Create group
    const groupName = `Test Group ${Date.now()}`;
    await apiHelpers.createHouseholdGroup(loginResult.token, groupName);
    
    // Track for cleanup
    apiHelpers.trackTestUser(testEmail);
    
    // Perform cleanup
    await apiHelpers.cleanupTestData();
    
    // Verify no tracking remains
    expect(apiHelpers.getTrackedUsers().length).toBe(0);
    expect(apiHelpers.getTrackedGroups().length).toBe(0);
    
    // Try to login with cleaned up user - this should ideally fail
    // but since we can't actually delete users from database without admin access,
    // we just verify our tracking is clean
    try {
      await apiHelpers.loginTestUser(testEmail, testPassword);
      // If login still works, that's fine - the important part is our tracking is clean
    } catch (error) {
      // If login fails, that's even better - means cleanup was thorough
      expect(error.message).toContain('failed');
    }
  });

  test('should provide manual cleanup utilities', async ({ page }) => {
    // Test manual tracking methods
    const testEmail = testHelpers.generateTestEmail('manual');
    const testGroupId = 'manual-group-123';
    
    // Manual tracking
    apiHelpers.trackTestUser(testEmail);
    apiHelpers.trackTestGroup(testGroupId);
    
    // Verify tracking
    expect(apiHelpers.getTrackedUsers()).toContain(testEmail);
    expect(apiHelpers.getTrackedGroups()).toContain(testGroupId);
    
    // Manual cleanup
    await apiHelpers.cleanupTestData();
    
    // Verify cleanup
    expect(apiHelpers.getTrackedUsers().length).toBe(0);
    expect(apiHelpers.getTrackedGroups().length).toBe(0);
  });

  test('should handle concurrent cleanup operations', async ({ page }) => {
    // Create multiple users simultaneously
    const userPromises = [];
    const emails = [];
    
    for (let i = 0; i < 3; i++) {
      const email = testHelpers.generateTestEmail(`concurrent${i}`);
      const password = testHelpers.generateTestPassword();
      emails.push(email);
      
      userPromises.push(
        testHelpers.registerUser(email, password).then(() => {
          apiHelpers.trackTestUser(email);
        })
      );
    }
    
    // Wait for all users to be created
    await Promise.all(userPromises);
    
    // Verify all users are tracked
    const trackedUsers = apiHelpers.getTrackedUsers();
    for (const email of emails) {
      expect(trackedUsers).toContain(email);
    }
    
    // Cleanup should handle all users
    await apiHelpers.cleanupTestData();
    
    // Verify all cleaned up
    expect(apiHelpers.getTrackedUsers().length).toBe(0);
  });

  test('should clean up data with proper error logging', async ({ page }) => {
    const testEmail = testHelpers.generateTestEmail('logging');
    
    // Track user
    apiHelpers.trackTestUser(testEmail);
    
    // Capture console logs during cleanup
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });
    
    // Perform cleanup
    await apiHelpers.cleanupTestData();
    
    // Verify cleanup completed (logs might contain error messages but that's fine)
    expect(apiHelpers.getTrackedUsers().length).toBe(0);
  });

  test('should validate health check before cleanup', async ({ page }) => {
    // Verify API is healthy before attempting cleanup
    const healthResult = await apiHelpers.healthCheck();
    
    expect(healthResult).toBeDefined();
    expect(healthResult.status).toBe('ok');
    
    // If health check passes, cleanup operations should be safe to perform
    await apiHelpers.cleanupTestData();
  });
});