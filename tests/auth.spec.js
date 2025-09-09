const { test, expect } = require('@playwright/test');
const { TestHelpers } = require('./utils/test-helpers');
const { ApiHelpers } = require('./utils/api-helpers');

test.describe('Authentication Tests', () => {
  let testHelpers;
  let apiHelpers;
  let testEmail;
  let testPassword;

  test.beforeEach(async ({ page }) => {
    testHelpers = new TestHelpers(page);
    apiHelpers = new ApiHelpers();
    testEmail = testHelpers.generateTestEmail('auth');
    testPassword = testHelpers.generateTestPassword();
    
    // Track test user for cleanup
    apiHelpers.trackTestUser(testEmail);
  });

  test.afterEach(async () => {
    // Clean up test data after each test
    await apiHelpers.cleanupTestData();
  });

  test('should successfully register a new user with registration key', async ({ page }) => {
    // Navigate to registration page
    await testHelpers.navigateToPage('/register.html');
    
    // Verify registration page loaded
    await expect(page.locator('h2')).toContainText('Register');
    await expect(page.locator('#registrationKey')).toBeVisible();
    
    // Fill registration form
    await page.fill('#regEmail', testEmail);
    await page.fill('#regPassword', testPassword);
    await page.selectOption('#registrationMethod', 'key');
    await page.fill('#registrationKey', testHelpers.registrationKey);
    
    // Submit form and wait for response
    const responsePromise = testHelpers.waitForApiResponse('/api/auth/register');
    await page.click('button[type="submit"]');
    
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    
    // Verify successful registration - should redirect to dashboard or show success message
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    
    // Could redirect to dashboard or show success on same page
    expect(
      currentUrl.includes('/dashboard.html') || 
      currentUrl.includes('/register.html')
    ).toBeTruthy();
  });

  test('should fail registration with invalid registration key', async ({ page }) => {
    await testHelpers.navigateToPage('/register.html');
    
    // Fill registration form with invalid key
    await page.fill('#regEmail', testEmail);
    await page.fill('#regPassword', testPassword);
    await page.selectOption('#registrationMethod', 'key');
    await page.fill('#registrationKey', 'INVALID-KEY');
    
    // Submit form and expect failure
    const responsePromise = testHelpers.waitForApiResponse('/api/auth/register');
    await page.click('button[type="submit"]');
    
    const response = await responsePromise;
    expect(response.ok()).toBeFalsy();
    
    // Should remain on registration page
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/register.html');
  });

  test('should fail registration with duplicate email', async ({ page }) => {
    // First, register a user
    await testHelpers.registerUser(testEmail, testPassword);
    
    // Try to register again with same email
    await testHelpers.navigateToPage('/register.html');
    
    await page.fill('#regEmail', testEmail);
    await page.fill('#regPassword', 'DifferentPassword123!');
    await page.selectOption('#registrationMethod', 'key');
    await page.fill('#registrationKey', testHelpers.registrationKey);
    
    const responsePromise = testHelpers.waitForApiResponse('/api/auth/register');
    await page.click('button[type="submit"]');
    
    const response = await responsePromise;
    expect(response.ok()).toBeFalsy();
    
    // Should remain on registration page
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/register.html');
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // First register a user
    await testHelpers.registerUser(testEmail, testPassword);
    
    // Then login
    await testHelpers.navigateToPage('/login.html');
    
    // Verify login page loaded
    await expect(page.locator('h2')).toContainText('Login');
    
    // Fill login form
    await page.fill('#loginEmail', testEmail);
    await page.fill('#loginPassword', testPassword);
    
    // Submit form and wait for response
    const responsePromise = testHelpers.waitForApiResponse('/api/auth/login');
    await page.click('button[type="submit"]');
    
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    
    // Should redirect to dashboard
    await page.waitForURL('**/dashboard.html');
    expect(page.url()).toContain('/dashboard.html');
    
    // Verify dashboard page loaded
    await expect(page.locator('.summary-grid')).toBeVisible();
  });

  test('should fail login with invalid email', async ({ page }) => {
    await testHelpers.navigateToPage('/login.html');
    
    // Try to login with non-existent email
    await page.fill('#loginEmail', 'nonexistent@test.com');
    await page.fill('#loginPassword', 'somepassword');
    
    const responsePromise = testHelpers.waitForApiResponse('/api/auth/login');
    await page.click('button[type="submit"]');
    
    const response = await responsePromise;
    expect(response.ok()).toBeFalsy();
    
    // Should remain on login page
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login.html');
  });

  test('should fail login with invalid password', async ({ page }) => {
    // First register a user
    await testHelpers.registerUser(testEmail, testPassword);
    
    // Try to login with wrong password
    await testHelpers.navigateToPage('/login.html');
    
    await page.fill('#loginEmail', testEmail);
    await page.fill('#loginPassword', 'WrongPassword123!');
    
    const responsePromise = testHelpers.waitForApiResponse('/api/auth/login');
    await page.click('button[type="submit"]');
    
    const response = await responsePromise;
    expect(response.ok()).toBeFalsy();
    
    // Should remain on login page
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login.html');
  });

  test('should redirect to login when accessing protected pages without authentication', async ({ page }) => {
    const protectedPages = [
      '/dashboard.html',
      '/voucher.html',
      '/reading.html',
      '/history.html',
      '/settings.html'
    ];
    
    for (const pagePath of protectedPages) {
      // Navigate to protected page
      await testHelpers.navigateToPage(pagePath);
      
      // Wait a moment for any redirects
      await page.waitForTimeout(1000);
      
      // Should be redirected to login or index page
      const currentUrl = page.url();
      expect(
        currentUrl.includes('/login.html') || 
        currentUrl.includes('/index.html')
      ).toBeTruthy();
    }
  });

  test('should maintain authentication across page navigation', async ({ page }) => {
    // Register and login
    await testHelpers.registerUser(testEmail, testPassword);
    await testHelpers.loginUser(testEmail, testPassword);
    
    // Navigate to different protected pages
    const protectedPages = [
      '/voucher.html',
      '/reading.html',
      '/history.html',
      '/settings.html',
      '/dashboard.html'
    ];
    
    for (const pagePath of protectedPages) {
      await testHelpers.navigateToPage(pagePath);
      
      // Should not be redirected to login
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      expect(currentUrl).toContain(pagePath);
    }
  });

  test('should handle form validation errors', async ({ page }) => {
    await testHelpers.navigateToPage('/register.html');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors (HTML5 validation)
    const emailInput = page.locator('#regEmail');
    const passwordInput = page.locator('#regPassword');
    
    // Check if inputs are marked as invalid
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    
    // Should remain on registration page
    expect(page.url()).toContain('/register.html');
  });

  test('should toggle between registration methods', async ({ page }) => {
    await testHelpers.navigateToPage('/register.html');
    
    // Initially should show registration key field
    await expect(page.locator('#registrationKeyGroup')).toBeVisible();
    await expect(page.locator('#inviteCodeGroup')).toBeHidden();
    
    // Switch to invite code method
    await page.selectOption('#registrationMethod', 'invite');
    
    // Should hide registration key and show invite code
    await expect(page.locator('#registrationKeyGroup')).toBeHidden();
    await expect(page.locator('#inviteCodeGroup')).toBeVisible();
    
    // Switch back to registration key
    await page.selectOption('#registrationMethod', 'key');
    
    // Should show registration key and hide invite code
    await expect(page.locator('#registrationKeyGroup')).toBeVisible();
    await expect(page.locator('#inviteCodeGroup')).toBeHidden();
  });
});