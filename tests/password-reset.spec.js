const { test, expect } = require('@playwright/test');
const { TestHelpers } = require('./utils/test-helpers');
const { ApiHelpers } = require('./utils/api-helpers');

const DEBUG_TOKEN_ENV = process.env.ENABLE_RESET_TOKEN_DEBUG === 'true';
const REQUIRED_REG_KEY = process.env.TEST_REGISTRATION_KEY;

if (!REQUIRED_REG_KEY) {
  console.warn('[password-reset.spec] TEST_REGISTRATION_KEY is not set. Registration requests may fail.');
}

if (!DEBUG_TOKEN_ENV) {
  console.warn('[password-reset.spec] ENABLE_RESET_TOKEN_DEBUG is not set to "true". Debug tokens will not be returned by the API. Some tests will be skipped.');
}

test.describe('Password Reset Flow', () => {
  let testHelpers;
  let apiHelpers;
  let initialPassword;
  let testEmail;

  test.beforeEach(async ({ page }) => {
    testHelpers = new TestHelpers(page);
    apiHelpers = new ApiHelpers();
    initialPassword = testHelpers.generateTestPassword();
    testEmail = testHelpers.generateTestEmail('forgot');
  });

  test.afterEach(async () => {
    await apiHelpers.cleanupTestData();
  });

  test('migration is applied enabling password reset persistence', async () => {
    if (!REQUIRED_REG_KEY) {
      test.skip('TEST_REGISTRATION_KEY is required to create a test user');
    }

    const registration = await apiHelpers.registerTestUser(testEmail, initialPassword, REQUIRED_REG_KEY);
    expect(registration?.success).toBeTruthy();

    const { response, body } = await apiHelpers.requestPasswordReset(testEmail);
    expect(response.ok()).toBeTruthy();
    expect(body?.success).toBeTruthy();
    expect(body?.message).toContain('password reset link');

    if (DEBUG_TOKEN_ENV) {
      expect(body?.debugToken).toBeTruthy();
      const { response: validateResponse, body: validateBody } = await apiHelpers.validatePasswordResetToken(body.debugToken);
      expect(validateResponse.ok()).toBeTruthy();
      expect(validateBody?.valid).toBeTruthy();
      expect(validateBody?.email?.toLowerCase()).toBe(testEmail.toLowerCase());
    }
  });

  test('forgot password request dispatches reset email when configured', async () => {
    if (!REQUIRED_REG_KEY) {
      test.skip('TEST_REGISTRATION_KEY is required to create a test user');
    }

    await apiHelpers.registerTestUser(testEmail, initialPassword, REQUIRED_REG_KEY);

    const { response, body } = await apiHelpers.requestPasswordReset(testEmail);
    expect(response.ok()).toBeTruthy();
    expect(body?.success).toBeTruthy();
    expect(typeof body?.emailDispatched).toBe('boolean');
    expect(body?.emailDispatched).toBeTruthy();
  });

  test('user can request a reset link from the login UI', async ({ page }) => {
    if (!REQUIRED_REG_KEY) {
      test.skip('TEST_REGISTRATION_KEY is required to create a test user');
    }

    await apiHelpers.registerTestUser(testEmail, initialPassword, REQUIRED_REG_KEY);

    await testHelpers.navigateToPage('/login.html');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await page.waitForURL('**/forgot-password.html');

    const responsePromise = testHelpers.waitForApiResponse('/api/auth/forgot-password');

    await page.fill('#email', testEmail);
    await page.click('button[type="submit"]');

    const response = await responsePromise;
    const responseBody = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(responseBody?.success).toBeTruthy();
    await expect(page.locator('#forgotPasswordMessage')).toBeVisible();
    await expect(page.locator('#forgotPasswordMessage')).toContainText('password reset link');
  });

  test('user can reset password and authenticate with the new credentials', async ({ page }) => {
    if (!REQUIRED_REG_KEY) {
      test.skip('TEST_REGISTRATION_KEY is required to create a test user');
    }

    if (!DEBUG_TOKEN_ENV) {
      test.skip('ENABLE_RESET_TOKEN_DEBUG must be set to "true" to retrieve the debug token for automated testing');
    }

    await apiHelpers.registerTestUser(testEmail, initialPassword, REQUIRED_REG_KEY);
    const resetResponse = await apiHelpers.requestPasswordReset(testEmail);

    expect(resetResponse.body?.debugToken).toBeTruthy();
    const resetToken = resetResponse.body.debugToken;

    await testHelpers.navigateToPage(`/reset-password.html?token=${resetToken}`);
    await expect(page.locator('#resetStatusMessage')).toContainText(testEmail.toLowerCase());

    const newPassword = testHelpers.generateTestPassword();
    const apiResponsePromise = testHelpers.waitForApiResponse('/api/auth/reset-password');

    await page.fill('#newPassword', newPassword);
    await page.fill('#confirmPassword', newPassword);
    await page.click('button[type="submit"]');

    const apiResponse = await apiResponsePromise;
    const apiResponseBody = await apiResponse.json();

    expect(apiResponse.ok()).toBeTruthy();
    expect(apiResponseBody?.success).toBeTruthy();
    await expect(page.locator('#resetStatusMessage')).toContainText('Password reset successful');
    await expect(page.locator('#resetPasswordForm')).toBeHidden();

    await expect(async () => {
      await apiHelpers.loginTestUser(testEmail, initialPassword);
    }).rejects.toThrow();

    const loginResponse = await apiHelpers.loginTestUser(testEmail, newPassword);
    expect(loginResponse?.token).toBeTruthy();

    const secondResetAttempt = await apiHelpers.resetPassword(resetToken, testHelpers.generateTestPassword());
    expect(secondResetAttempt.success).toBeFalsy();
    expect(secondResetAttempt.body?.error).toContain('already been used');
  });
});
