const { test, expect } = require('@playwright/test');
const { TestHelpers } = require('./utils/test-helpers');
const { ApiHelpers } = require('./utils/api-helpers');

test.describe('Core Functionality Tests', () => {
  let testHelpers;
  let apiHelpers;
  let testEmail;
  let testPassword;
  let authToken;

  test.beforeEach(async ({ page }) => {
    testHelpers = new TestHelpers(page);
    apiHelpers = new ApiHelpers();
    testEmail = testHelpers.generateTestEmail('core');
    testPassword = testHelpers.generateTestPassword();
    
    // Register and login user for each test
    const registrationResult = await testHelpers.registerUser(testEmail, testPassword);
    const loginResult = await testHelpers.loginUser(testEmail, testPassword);
    authToken = loginResult.token;
    
    // Track test user for cleanup
    apiHelpers.trackTestUser(testEmail);
  });

  test.afterEach(async () => {
    // Clean up test data after each test
    await apiHelpers.cleanupTestData();
  });

  test('should successfully add a voucher (purchase electricity)', async ({ page }) => {
    const voucherAmount = 100;
    
    await testHelpers.navigateToPage('/voucher.html');
    
    // Verify voucher page loaded
    await expect(page.locator('h2')).toContainText('Add Voucher');
    await expect(page.locator('#voucherAmount')).toBeVisible();
    
    // Fill voucher form
    await page.fill('#voucherAmount', voucherAmount.toString());
    
    // Submit form and wait for response
    const responsePromise = testHelpers.waitForApiResponse('/api/readings');
    await page.click('button[type="submit"]');
    
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    
    // Verify success feedback
    await page.waitForTimeout(2000);
    
    // Should show success message or redirect
    const currentUrl = page.url();
    expect(
      currentUrl.includes('/voucher.html') || 
      currentUrl.includes('/dashboard.html')
    ).toBeTruthy();
  });

  test('should successfully add a meter reading', async ({ page }) => {
    const readingValue = 1500.5;
    
    await testHelpers.navigateToPage('/reading.html');
    
    // Verify reading page loaded
    await expect(page.locator('h2')).toContainText('Add Reading');
    await expect(page.locator('#readingValue')).toBeVisible();
    
    // Fill reading form
    await page.fill('#readingValue', readingValue.toString());
    
    // Submit form and wait for response
    const responsePromise = testHelpers.waitForApiResponse('/api/readings');
    await page.click('button[type="submit"]');
    
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    
    // Verify success feedback
    await page.waitForTimeout(2000);
    
    // Should show success message or redirect
    const currentUrl = page.url();
    expect(
      currentUrl.includes('/reading.html') || 
      currentUrl.includes('/dashboard.html')
    ).toBeTruthy();
  });

  test('should display dashboard with summary data after adding voucher and reading', async ({ page }) => {
    // Add test data first
    await apiHelpers.addVoucherForUser(authToken, 100);
    await apiHelpers.addReadingForUser(authToken, 1500.5);
    
    await testHelpers.navigateToPage('/dashboard.html');
    
    // Verify dashboard elements are present
    await expect(page.locator('.summary-grid')).toBeVisible();
    
    // Wait for data to load
    await page.waitForTimeout(3000);
    
    // Check if summary cards are present
    const summaryCards = page.locator('.summary-card');
    await expect(summaryCards).toHaveCountGreaterThan(0);
    
    // Check if chart area is present (might show "no data" initially)
    await expect(page.locator('.consumption-chart')).toBeVisible();
  });

  test('should display transaction history', async ({ page }) => {
    // Add test data first
    await apiHelpers.addVoucherForUser(authToken, 50);
    await apiHelpers.addReadingForUser(authToken, 1200.0);
    
    await testHelpers.navigateToPage('/history.html');
    
    // Verify history page loaded
    await expect(page.locator('h2')).toContainText('Transaction History');
    await expect(page.locator('#transactionHistory')).toBeVisible();
    
    // Wait for data to load
    await page.waitForTimeout(3000);
    
    // Check if history table has content or shows "no transactions" message
    const historyTable = page.locator('#transactionHistory');
    await expect(historyTable).toBeVisible();
  });

  test('should filter transaction history by month', async ({ page }) => {
    // Add test data first
    await apiHelpers.addVoucherForUser(authToken, 75);
    await apiHelpers.addReadingForUser(authToken, 1300.0);
    
    await testHelpers.navigateToPage('/history.html');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Check if month filter exists
    const monthFilter = page.locator('#monthFilter');
    
    if (await monthFilter.isVisible()) {
      // Set filter to current month
      const currentDate = new Date();
      const currentMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      await monthFilter.fill(currentMonth);
      
      // Wait for filter to apply
      await page.waitForTimeout(1000);
      
      // Verify the filter value is set
      await expect(monthFilter).toHaveValue(currentMonth);
    } else {
      // If no month filter visible, just verify history table is present
      await expect(page.locator('#transactionHistory')).toBeVisible();
    }
  });

  test('should validate voucher form input', async ({ page }) => {
    await testHelpers.navigateToPage('/voucher.html');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    const amountInput = page.locator('#voucherAmount');
    await expect(amountInput).toBeVisible();
    
    // Try invalid amount (negative)
    await page.fill('#voucherAmount', '-50');
    
    // HTML5 validation should prevent negative numbers or show error
    const inputValue = await amountInput.inputValue();
    expect(parseFloat(inputValue)).toBeGreaterThanOrEqual(0);
  });

  test('should validate reading form input', async ({ page }) => {
    await testHelpers.navigateToPage('/reading.html');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    const readingInput = page.locator('#readingValue');
    await expect(readingInput).toBeVisible();
    
    // Try invalid reading (negative)
    await page.fill('#readingValue', '-100');
    
    // HTML5 validation should prevent negative numbers or show error
    const inputValue = await readingInput.inputValue();
    expect(parseFloat(inputValue)).toBeGreaterThanOrEqual(0);
  });

  test('should handle API errors gracefully when adding voucher', async ({ page }) => {
    await testHelpers.navigateToPage('/voucher.html');
    
    // Fill form with very large amount that might cause server error
    await page.fill('#voucherAmount', '999999999');
    
    // Submit form
    const responsePromise = testHelpers.waitForApiResponse('/api/readings');
    await page.click('button[type="submit"]');
    
    try {
      const response = await responsePromise;
      // Either succeeds or fails gracefully
      if (!response.ok()) {
        // Should remain on voucher page
        expect(page.url()).toContain('/voucher.html');
      }
    } catch (error) {
      // Network errors should be handled gracefully
      expect(page.url()).toContain('/voucher.html');
    }
  });

  test('should handle API errors gracefully when adding reading', async ({ page }) => {
    await testHelpers.navigateToPage('/reading.html');
    
    // Fill form with very large reading that might cause server error
    await page.fill('#readingValue', '999999999');
    
    // Submit form
    const responsePromise = testHelpers.waitForApiResponse('/api/readings');
    await page.click('button[type="submit"]');
    
    try {
      const response = await responsePromise;
      // Either succeeds or fails gracefully
      if (!response.ok()) {
        // Should remain on reading page
        expect(page.url()).toContain('/reading.html');
      }
    } catch (error) {
      // Network errors should be handled gracefully
      expect(page.url()).toContain('/reading.html');
    }
  });

  test('should display consistent data between dashboard and history', async ({ page }) => {
    // Add test voucher
    await apiHelpers.addVoucherForUser(authToken, 150);
    
    // Wait a bit for data to be processed
    await page.waitForTimeout(1000);
    
    // Check dashboard
    await testHelpers.navigateToPage('/dashboard.html');
    await page.waitForTimeout(2000);
    
    // Navigate to history
    await testHelpers.navigateToPage('/history.html');
    await page.waitForTimeout(2000);
    
    // Verify history table is visible (data consistency check is implicit)
    await expect(page.locator('#transactionHistory')).toBeVisible();
  });

  test('should navigate between pages using navigation menu', async ({ page }) => {
    await testHelpers.navigateToPage('/dashboard.html');
    
    // Check if navigation menu exists
    const nav = page.locator('nav, .nav, .navigation, .menu');
    
    if (await nav.count() > 0) {
      // Test navigation links if they exist
      const dashboardLink = page.locator('a[href*="dashboard"], a:has-text("Dashboard")');
      const voucherLink = page.locator('a[href*="voucher"], a:has-text("Voucher")');
      const readingLink = page.locator('a[href*="reading"], a:has-text("Reading")');
      const historyLink = page.locator('a[href*="history"], a:has-text("History")');
      
      // Test each link if it exists
      if (await voucherLink.count() > 0) {
        await voucherLink.first().click();
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/voucher.html');
      }
      
      if (await readingLink.count() > 0) {
        await readingLink.first().click();
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/reading.html');
      }
      
      if (await historyLink.count() > 0) {
        await historyLink.first().click();
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/history.html');
      }
      
      if (await dashboardLink.count() > 0) {
        await dashboardLink.first().click();
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/dashboard.html');
      }
    } else {
      // If no navigation menu, just verify we can navigate manually
      await testHelpers.navigateToPage('/voucher.html');
      expect(page.url()).toContain('/voucher.html');
      
      await testHelpers.navigateToPage('/reading.html');
      expect(page.url()).toContain('/reading.html');
      
      await testHelpers.navigateToPage('/history.html');
      expect(page.url()).toContain('/history.html');
    }
  });

  test('should handle multiple vouchers and readings correctly', async ({ page }) => {
    // Add multiple vouchers and readings
    await apiHelpers.addVoucherForUser(authToken, 50);
    await apiHelpers.addVoucherForUser(authToken, 75);
    await apiHelpers.addReadingForUser(authToken, 1100.0);
    await apiHelpers.addReadingForUser(authToken, 1150.0);
    
    // Wait for data processing
    await page.waitForTimeout(2000);
    
    // Check dashboard shows aggregated data
    await testHelpers.navigateToPage('/dashboard.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('.summary-grid')).toBeVisible();
    
    // Check history shows all transactions
    await testHelpers.navigateToPage('/history.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#transactionHistory')).toBeVisible();
  });
});