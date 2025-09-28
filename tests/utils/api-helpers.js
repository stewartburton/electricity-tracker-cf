const { request } = require('@playwright/test');

/**
 * API Helper Functions for Direct Database Operations
 * Used for test data cleanup and setup
 */

class ApiHelpers {
  constructor() {
    this.baseURL = process.env.TEST_BASE_URL || 'https://electricity-tracker.electricity-monitor.workers.dev';
    this.testUsers = new Set();
    this.testGroups = new Set();
    this.userPasswords = new Map();
  }

  /**
   * Create a request context for API calls
   */
  async createRequestContext() {
    const context = await request.newContext({
      baseURL: this.baseURL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    return context;
  }

  /**
   * Register a test user and track it for cleanup
   */
  async registerTestUser(email, password, registrationKey = 'STU-KRISY-2025', inviteCode = null) {
    const context = await this.createRequestContext();
    
    try {
      const response = await context.post('/api/auth/register', {
        data: {
          email,
          password,
          registrationKey: inviteCode ? undefined : registrationKey,
          inviteCode
        }
      });

      const responseBody = await response.json();
      
      if (response.ok()) {
        // Track user for cleanup
        this.testUsers.add(email);
        this.userPasswords.set(email, password);
        return responseBody;
      } else {
        throw new Error(`Registration failed: ${responseBody.error || 'Unknown error'}`);
      }
    } finally {
      await context.dispose();
    }
  }

  /**
   * Login a test user
   */
  async loginTestUser(email, password) {
    const context = await this.createRequestContext();

    try {
      const response = await context.post('/api/auth/login', {
        data: {
          email,
          password
        }
      });

      const responseBody = await response.json();
      
      if (response.ok()) {
        this.userPasswords.set(email, password);
        return responseBody;
      } else {
        throw new Error(`Login failed: ${responseBody.error || 'Unknown error'}`);
      }
    } finally {
      await context.dispose();
    }
  }

  /**
   * Add a voucher for a user
   */
  async addVoucherForUser(token, amount) {
    const context = await this.createRequestContext();
    
    try {
      const response = await context.post('/api/readings', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          type: 'voucher',
          amount: amount,
          reading: null
        }
      });

      const responseBody = await response.json();
      
      if (response.ok()) {
        return responseBody;
      } else {
        throw new Error(`Add voucher failed: ${responseBody.error || 'Unknown error'}`);
      }
    } finally {
      await context.dispose();
    }
  }

  /**
   * Add a reading for a user
   */
  async addReadingForUser(token, reading) {
    const context = await this.createRequestContext();
    
    try {
      const response = await context.post('/api/readings', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          type: 'reading',
          reading: reading,
          amount: null
        }
      });

      const responseBody = await response.json();
      
      if (response.ok()) {
        return responseBody;
      } else {
        throw new Error(`Add reading failed: ${responseBody.error || 'Unknown error'}`);
      }
    } finally {
      await context.dispose();
    }
  }

  /**
   * Create a household group
   */
  async createHouseholdGroup(token, groupName) {
    const context = await this.createRequestContext();
    
    try {
      const response = await context.post('/api/account/create-group', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          groupName
        }
      });

      const responseBody = await response.json();
      
      if (response.ok()) {
        // Track group for cleanup
        this.testGroups.add(responseBody.groupId);
        return responseBody;
      } else {
        throw new Error(`Create group failed: ${responseBody.error || 'Unknown error'}`);
      }
    } finally {
      await context.dispose();
    }
  }

  /**
   * Join a household group
   */
  async joinHouseholdGroup(token, inviteCode) {
    const context = await this.createRequestContext();
    
    try {
      const response = await context.post('/api/account/join-group', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          inviteCode
        }
      });

      const responseBody = await response.json();
      
      if (response.ok()) {
        return responseBody;
      } else {
        throw new Error(`Join group failed: ${responseBody.error || 'Unknown error'}`);
      }
    } finally {
      await context.dispose();
    }
  }

  /**
   * Leave a household group
   */
  async leaveHouseholdGroup(token) {
    const context = await this.createRequestContext();
    
    try {
      const response = await context.post('/api/account/leave-group', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const responseBody = await response.json();
      
      if (response.ok()) {
        return responseBody;
      } else {
        throw new Error(`Leave group failed: ${responseBody.error || 'Unknown error'}`);
      }
    } finally {
      await context.dispose();
    }
  }

  /**
   * Get account info
   */
  async getAccountInfo(token) {
    const context = await this.createRequestContext();
    
    try {
      const response = await context.get('/api/account/info', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const responseBody = await response.json();
      
      if (response.ok()) {
        return responseBody;
      } else {
        throw new Error(`Get account info failed: ${responseBody.error || 'Unknown error'}`);
      }
    } finally {
      await context.dispose();
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(token) {
    const context = await this.createRequestContext();
    
    try {
      const response = await context.get('/api/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const responseBody = await response.json();
      
      if (response.ok()) {
        return responseBody;
      } else {
        throw new Error(`Get dashboard data failed: ${responseBody.error || 'Unknown error'}`);
      }
    } finally {
      await context.dispose();
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(token, month = null) {
    const context = await this.createRequestContext();
    
    try {
      let url = '/api/transactions';
      if (month) {
        url += `?month=${month}`;
      }

      const response = await context.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const responseBody = await response.json();
      
      if (response.ok()) {
        return responseBody;
      } else {
        throw new Error(`Get transactions failed: ${responseBody.error || 'Unknown error'}`);
      }
    } finally {
      await context.dispose();
    }
  }

  /**
   * Clean up all test data
   * NOTE: This would require direct database access or admin endpoints
   * For now, we'll implement basic cleanup that we can do through the API
   */
  async cleanupTestData() {
    console.log(`Cleaning up test data for ${this.testUsers.size} users and ${this.testGroups.size} groups`);

    // For each test user, try to clean up their data
    for (const email of this.testUsers) {
      try {
        // Login to get token
        const password = this.userPasswords.get(email) || 'TestPassword123!';
        const loginResponse = await this.loginTestUser(email, password);
        if (loginResponse.token) {
          // Leave any groups they might be in
          try {
            await this.leaveHouseholdGroup(loginResponse.token);
          } catch (e) {
            // User might not be in a group, ignore error
          }
        }
      } catch (error) {
        console.log(`Could not clean up user ${email}:`, error.message);
      }
      this.userPasswords.delete(email);
    }

    // Clear tracking sets
    this.testUsers.clear();
    this.testGroups.clear();
    this.userPasswords.clear();
  }

  /**
   * Add a test user to tracking (for manual registrations)
   */
  trackTestUser(email, password = null) {
    this.testUsers.add(email);
    if (password) {
      this.userPasswords.set(email, password);
    }
  }

  /**
   * Add a test group to tracking (for manual group creation)
   */
  trackTestGroup(groupId) {
    this.testGroups.add(groupId);
  }

  /**
   * Get list of tracked test users
   */
  getTrackedUsers() {
    return Array.from(this.testUsers);
  }

  /**
   * Get list of tracked test groups
   */
  getTrackedGroups() {
    return Array.from(this.testGroups);
  }

  /**
   * Health check for the API
   */
  async healthCheck() {
    const context = await this.createRequestContext();
    
    try {
      const response = await context.get('/api/health');
      const responseBody = await response.json();
      
      if (response.ok()) {
        return responseBody;
      } else {
        throw new Error(`Health check failed: ${response.status()}`);
      }
    } finally {
      await context.dispose();
    }
  }

  async requestPasswordReset(email) {
    const context = await this.createRequestContext();

    try {
      const response = await context.post('/api/auth/forgot-password', {
        data: { email }
      });

      const responseBody = await response.json();
      return { response, body: responseBody };
    } finally {
      await context.dispose();
    }
  }

  async validatePasswordResetToken(token) {
    const context = await this.createRequestContext();

    try {
      const response = await context.get(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
      const responseBody = await response.json();
      return { response, body: responseBody };
    } finally {
      await context.dispose();
    }
  }

  async resetPassword(token, password) {
    const context = await this.createRequestContext();

    try {
      const response = await context.post('/api/auth/reset-password', {
        data: { token, password }
      });

      const responseBody = await response.json();
      return { response, body: responseBody, success: response.ok() };
    } finally {
      await context.dispose();
    }
  }
}

module.exports = { ApiHelpers };
