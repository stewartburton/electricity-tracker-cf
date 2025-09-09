const { expect } = require('@playwright/test');

/**
 * Test Helper Functions for Electricity Tracker Application
 */

class TestHelpers {
  constructor(page) {
    this.page = page;
    this.baseURL = 'https://electricity-tracker.electricity-monitor.workers.dev';
    this.registrationKey = 'STU-KRISY-2025';
  }

  /**
   * Generate a unique test email with timestamp
   */
  generateTestEmail(prefix = 'test') {
    const timestamp = Date.now();
    return `${prefix}.${timestamp}@playwright-test.com`;
  }

  /**
   * Generate a secure test password
   */
  generateTestPassword() {
    const timestamp = Date.now();
    return `TestPass${timestamp}!`;
  }

  /**
   * Navigate to a specific page and wait for it to load
   */
  async navigateToPage(path) {
    await this.page.goto(`${this.baseURL}${path}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for API response and return the response
   */
  async waitForApiResponse(urlPattern, method = 'POST') {
    const responsePromise = this.page.waitForResponse(response =>
      response.url().includes(urlPattern) && response.request().method() === method
    );
    return responsePromise;
  }

  /**
   * Register a new user account
   */
  async registerUser(email, password, useRegistrationKey = true, inviteCode = null) {
    await this.navigateToPage('/register.html');
    
    // Fill in registration form
    await this.page.fill('#regEmail', email);
    await this.page.fill('#regPassword', password);
    
    if (useRegistrationKey) {
      await this.page.selectOption('#registrationMethod', 'key');
      await this.page.fill('#registrationKey', this.registrationKey);
    } else if (inviteCode) {
      await this.page.selectOption('#registrationMethod', 'invite');
      await this.page.fill('#inviteCode', inviteCode);
    }

    // Wait for registration API response
    const responsePromise = this.waitForApiResponse('/api/auth/register');
    
    // Submit form
    await this.page.click('button[type="submit"]');
    
    const response = await responsePromise;
    const responseBody = await response.json();
    
    if (!response.ok()) {
      throw new Error(`Registration failed: ${responseBody.error || 'Unknown error'}`);
    }

    return responseBody;
  }

  /**
   * Login with email and password
   */
  async loginUser(email, password) {
    await this.navigateToPage('/login.html');
    
    // Fill in login form
    await this.page.fill('#loginEmail', email);
    await this.page.fill('#loginPassword', password);
    
    // Wait for login API response
    const responsePromise = this.waitForApiResponse('/api/auth/login');
    
    // Submit form
    await this.page.click('button[type="submit"]');
    
    const response = await responsePromise;
    const responseBody = await response.json();
    
    if (!response.ok()) {
      throw new Error(`Login failed: ${responseBody.error || 'Unknown error'}`);
    }

    // Wait for redirect to dashboard
    await this.page.waitForURL('**/dashboard.html');
    
    return responseBody;
  }

  /**
   * Add a voucher (purchase electricity)
   */
  async addVoucher(amount, token) {
    await this.navigateToPage('/voucher.html');
    
    // Wait for page to fully load
    await this.page.waitForSelector('#voucherAmount');
    
    // Fill in voucher form
    await this.page.fill('#voucherAmount', amount.toString());
    
    // Wait for voucher API response
    const responsePromise = this.waitForApiResponse('/api/readings');
    
    // Submit form
    await this.page.click('button[type="submit"]');
    
    const response = await responsePromise;
    
    if (!response.ok()) {
      const responseBody = await response.json();
      throw new Error(`Add voucher failed: ${responseBody.error || 'Unknown error'}`);
    }

    return await response.json();
  }

  /**
   * Add a meter reading
   */
  async addReading(reading, token) {
    await this.navigateToPage('/reading.html');
    
    // Wait for page to fully load
    await this.page.waitForSelector('#readingValue');
    
    // Fill in reading form
    await this.page.fill('#readingValue', reading.toString());
    
    // Wait for reading API response
    const responsePromise = this.waitForApiResponse('/api/readings');
    
    // Submit form
    await this.page.click('button[type="submit"]');
    
    const response = await responsePromise;
    
    if (!response.ok()) {
      const responseBody = await response.json();
      throw new Error(`Add reading failed: ${responseBody.error || 'Unknown error'}`);
    }

    return await response.json();
  }

  /**
   * Create a household group
   */
  async createHouseholdGroup(groupName) {
    await this.navigateToPage('/settings.html');
    
    // Wait for settings page to load
    await this.page.waitForSelector('#createGroupName');
    
    // Fill in group name
    await this.page.fill('#createGroupName', groupName);
    
    // Wait for create group API response
    const responsePromise = this.waitForApiResponse('/api/account/create-group');
    
    // Submit form
    await this.page.click('#createGroupBtn');
    
    const response = await responsePromise;
    const responseBody = await response.json();
    
    if (!response.ok()) {
      throw new Error(`Create household failed: ${responseBody.error || 'Unknown error'}`);
    }

    return responseBody;
  }

  /**
   * Join a household group with invite code
   */
  async joinHouseholdGroup(inviteCode) {
    await this.navigateToPage('/settings.html');
    
    // Wait for settings page to load
    await this.page.waitForSelector('#joinInviteCode');
    
    // Fill in invite code
    await this.page.fill('#joinInviteCode', inviteCode);
    
    // Wait for join group API response
    const responsePromise = this.waitForApiResponse('/api/account/join-group');
    
    // Submit form
    await this.page.click('#joinGroupBtn');
    
    const response = await responsePromise;
    const responseBody = await response.json();
    
    if (!response.ok()) {
      throw new Error(`Join household failed: ${responseBody.error || 'Unknown error'}`);
    }

    return responseBody;
  }

  /**
   * Leave household group
   */
  async leaveHouseholdGroup() {
    await this.navigateToPage('/settings.html');
    
    // Wait for leave group API response
    const responsePromise = this.waitForApiResponse('/api/account/leave-group');
    
    // Click leave group button
    await this.page.click('#leaveGroupBtn');
    
    const response = await responsePromise;
    const responseBody = await response.json();
    
    if (!response.ok()) {
      throw new Error(`Leave household failed: ${responseBody.error || 'Unknown error'}`);
    }

    return responseBody;
  }

  /**
   * Get dashboard data
   */
  async getDashboardData() {
    await this.navigateToPage('/dashboard.html');
    
    // Wait for dashboard to load and data to be fetched
    await this.page.waitForSelector('.summary-grid');
    
    // Wait a bit more for all API calls to complete
    await this.page.waitForTimeout(2000);
    
    return {
      url: this.page.url()
    };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory() {
    await this.navigateToPage('/history.html');
    
    // Wait for history table to load
    await this.page.waitForSelector('#transactionHistory');
    
    // Wait for API call to complete
    await this.page.waitForTimeout(2000);
    
    return {
      url: this.page.url()
    };
  }

  /**
   * Filter transactions by month
   */
  async filterTransactionsByMonth(year, month) {
    await this.navigateToPage('/history.html');
    
    // Wait for history page to load
    await this.page.waitForSelector('#monthFilter');
    
    // Set month filter
    const monthValue = `${year}-${month.toString().padStart(2, '0')}`;
    await this.page.fill('#monthFilter', monthValue);
    
    // Wait for filter to apply
    await this.page.waitForTimeout(1000);
    
    return {
      filteredMonth: monthValue
    };
  }

  /**
   * Check if user is authenticated (redirected to dashboard)
   */
  async checkAuthentication() {
    const currentUrl = this.page.url();
    return currentUrl.includes('/dashboard.html');
  }

  /**
   * Check if user is redirected to login when accessing protected page
   */
  async checkAuthenticationRedirect(protectedPath) {
    await this.navigateToPage(protectedPath);
    await this.page.waitForTimeout(1000);
    const currentUrl = this.page.url();
    return currentUrl.includes('/login.html') || currentUrl.includes('/index.html');
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(selector, timeout = 10000) {
    await this.page.waitForSelector(selector, { timeout });
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(name) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true
    });
  }

  /**
   * Wait for toast/notification message
   */
  async waitForNotification(expectedText = null, timeout = 5000) {
    try {
      // Common selectors for notifications/toasts
      const selectors = ['.toast', '.notification', '.alert', '.message'];
      
      for (const selector of selectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: timeout / selectors.length });
          const element = await this.page.locator(selector).first();
          const text = await element.textContent();
          
          if (expectedText && !text.includes(expectedText)) {
            continue;
          }
          
          return text;
        } catch (e) {
          // Continue to next selector
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = { TestHelpers };