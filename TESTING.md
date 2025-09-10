# Electricity Tracker - Playwright Test Suite

A comprehensive end-to-end test suite for the Electricity Tracker application using Playwright.

## 📋 Overview

This test suite covers all major functionality of the Electricity Tracker application:

- **Authentication Tests**: User registration, login, and session management
- **Core Functionality Tests**: Adding vouchers, meter readings, dashboard, and history
- **Account Management Tests**: Creating households, generating invite codes, joining/leaving groups
- **Data Cleanup Tests**: Automated cleanup of test data and artifacts

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Access to the live application at `https://electricity-tracker.electricity-monitor.workers.dev`

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Install Playwright Browsers**
   ```bash
   npx playwright install
   ```

3. **Verify Installation**
   ```bash
   node tests/test-runner.js check
   ```

### Running Tests

#### Using the Test Runner (Recommended)

```bash
# Run all tests
node tests/test-runner.js all

# Run specific test categories
node tests/test-runner.js auth        # Authentication tests
node tests/test-runner.js core        # Core functionality tests
node tests/test-runner.js account     # Account management tests
node tests/test-runner.js cleanup     # Data cleanup tests

# Run tests with browser visible
node tests/test-runner.js headed

# Run tests in interactive UI mode
node tests/test-runner.js ui

# Run smoke tests (quick validation)
node tests/test-runner.js smoke
```

#### Using Playwright CLI Directly

```bash
# Run all tests
npm test

# Run specific test file
npx playwright test tests/auth.spec.js

# Run tests in headed mode
npm run test:headed

# Run tests in debug mode
npm run test:debug

# Run tests in UI mode
npm run test:ui
```

## 📂 Test Structure

```
tests/
├── utils/
│   ├── test-helpers.js      # UI interaction helpers
│   └── api-helpers.js       # API interaction and cleanup helpers
├── auth.spec.js             # Authentication tests
├── core-functionality.spec.js # Core app functionality tests
├── account-management.spec.js  # Household management tests
├── data-cleanup.spec.js     # Data cleanup tests
├── test-runner.js           # Custom test runner with utilities
├── global-setup.js          # Global test setup
└── global-teardown.js       # Global test cleanup
```

## 🧪 Test Categories

### Authentication Tests (`auth.spec.js`)

- User registration with environment variable registration key
- User registration with invite codes
- User login with valid/invalid credentials
- Authentication redirects for protected pages
- Form validation and error handling
- Session persistence across page navigation

### Core Functionality Tests (`core-functionality.spec.js`)

- Adding vouchers (purchasing electricity)
- Adding meter readings
- Dashboard data display and aggregation
- Transaction history viewing and filtering
- Month filtering functionality
- Form validation and error handling
- API error handling and recovery

### Account Management Tests (`account-management.spec.js`)

- Creating household groups
- Generating and sharing invite codes
- Joining household groups via invite codes
- Leaving household groups
- Managing multiple users in same household
- Preventing duplicate group creation
- Group ownership and permissions

### Data Cleanup Tests (`data-cleanup.spec.js`)

- Automated tracking of test users and groups
- Cleanup of test data after each test run
- Error handling during cleanup operations
- Verification of cleanup completeness
- Concurrent cleanup operations
- Manual cleanup utilities

## 🔧 Configuration

### Playwright Configuration (`playwright.config.js`)

The test suite is configured to:
- Run tests against the live application URL
- Support multiple browsers (Chrome, Firefox, Safari)
- Include mobile viewports (Pixel 5, iPhone 12)
- Generate HTML, JSON, and JUnit reports
- Capture screenshots and videos on failure
- Enable tracing for debugging
- Set appropriate timeouts for API calls

### Test Data Management

- **Unique Test Emails**: Each test generates unique email addresses using timestamps
- **Secure Passwords**: Tests use dynamically generated secure passwords
- **Automatic Cleanup**: All test data is tracked and cleaned up automatically
- **Registration Key**: Tests use environment variable TEST_REGISTRATION_KEY

## 📊 Test Reports

After running tests, reports are available in:

- **HTML Report**: `test-results/index.html` (interactive report)
- **JSON Report**: `test-results.json` (machine-readable results)
- **JUnit Report**: `test-results.xml` (CI/CD integration)
- **Screenshots**: `test-results/screenshots/` (failure screenshots)
- **Videos**: `test-results/videos/` (failure recordings)
- **Traces**: `test-results/traces/` (detailed debugging traces)

### Viewing Reports

```bash
# Open HTML report
node tests/test-runner.js report

# Or open directly in browser
open test-results/index.html
```

## 🛠 Advanced Usage

### Running Tests for Specific Browsers

```bash
# Chrome only
node tests/test-runner.js browser chromium

# Firefox only
node tests/test-runner.js browser firefox

# Safari only
node tests/test-runner.js browser webkit
```

### Debugging Failed Tests

```bash
# Run in debug mode (pauses execution)
npx playwright test --debug

# Run with browser visible
node tests/test-runner.js headed

# Run specific test with debugging
npx playwright test tests/auth.spec.js --debug
```

### Environment Variables

You can customize test behavior using environment variables:

```bash
# Run in CI mode (more retries, less parallelism)
CI=true npm test

# Set custom timeout (in milliseconds)
PLAYWRIGHT_TIMEOUT=30000 npm test
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: 18
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright Browsers
      run: npx playwright install --with-deps
    - name: Run Playwright tests
      run: npm test
    - uses: actions/upload-artifact@v3
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
                sh 'npx playwright install --with-deps'
            }
        }
        stage('Test') {
            steps {
                sh 'npm test'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: false,
                        keepAll: true,
                        reportDir: 'playwright-report',
                        reportFiles: 'index.html',
                        reportName: 'Playwright Report'
                    ])
                    junit 'test-results.xml'
                }
            }
        }
    }
}
```

## 🚨 Troubleshooting

### Common Issues

#### Application Not Accessible

```
Error: Health check failed
```

**Solution**: Ensure the application is running at `https://electricity-tracker.electricity-monitor.workers.dev`

#### Browsers Not Installed

```
Error: Browser executable not found
```

**Solution**: Run `npx playwright install`

#### Test Data Conflicts

```
Error: Email already exists
```

**Solution**: Tests use unique timestamps in emails, but if running tests rapidly, ensure cleanup is working:

```bash
node tests/test-runner.js clean
```

#### Timeout Errors

```
Error: Timeout 30000ms exceeded
```

**Solutions**:
- Check network connectivity to the application
- Increase timeout in `playwright.config.js`
- Verify application is responding correctly

### Debugging Tips

1. **Use Headed Mode**: See what the browser is doing
   ```bash
   node tests/test-runner.js headed
   ```

2. **Use UI Mode**: Interactive test runner
   ```bash
   node tests/test-runner.js ui
   ```

3. **Check Screenshots**: Available in `test-results/screenshots/` after failures

4. **View Traces**: Detailed execution traces in `test-results/traces/`

5. **Enable Console Logs**: Add console logging in tests:
   ```javascript
   page.on('console', msg => console.log('PAGE LOG:', msg.text()));
   ```

## 📝 Writing New Tests

### Test Structure Template

```javascript
const { test, expect } = require('@playwright/test');
const { TestHelpers } = require('./utils/test-helpers');
const { ApiHelpers } = require('./utils/api-helpers');

test.describe('New Feature Tests', () => {
  let testHelpers;
  let apiHelpers;

  test.beforeEach(async ({ page }) => {
    testHelpers = new TestHelpers(page);
    apiHelpers = new ApiHelpers();
    
    // Setup test data
    const testEmail = testHelpers.generateTestEmail('feature');
    const testPassword = testHelpers.generateTestPassword();
    
    // Register and track user for cleanup
    await testHelpers.registerUser(testEmail, testPassword);
    apiHelpers.trackTestUser(testEmail);
  });

  test.afterEach(async () => {
    // Clean up test data
    await apiHelpers.cleanupTestData();
  });

  test('should test new feature', async ({ page }) => {
    // Your test code here
    await testHelpers.navigateToPage('/new-feature.html');
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

### Best Practices

1. **Use Unique Test Data**: Always generate unique emails and data
2. **Clean Up After Tests**: Track and clean up all test data
3. **Use Helper Functions**: Leverage existing helpers for common operations
4. **Add Descriptive Test Names**: Make test purposes clear
5. **Handle Async Operations**: Properly wait for API responses
6. **Include Error Cases**: Test both success and failure scenarios
7. **Use Page Object Pattern**: Keep selectors organized

## 🤝 Contributing

When adding new tests:

1. Follow the existing test structure and patterns
2. Add new helpers to the appropriate utility files
3. Ensure all test data is properly tracked for cleanup
4. Include both positive and negative test cases
5. Update this documentation for new features
6. Test your changes across different browsers

## 📞 Support

For issues with the test suite:

1. Check the troubleshooting section above
2. Review test logs and screenshots
3. Verify application accessibility
4. Check Playwright documentation
5. Create an issue with detailed error information

---

## 📈 Test Metrics

The test suite includes comprehensive coverage of:

- ✅ **Authentication Flow**: Registration, login, session management
- ✅ **Core Features**: Vouchers, readings, dashboard, history
- ✅ **Account Management**: Groups, invites, user management
- ✅ **Data Integrity**: Cleanup, validation, error handling
- ✅ **Cross-Browser**: Chrome, Firefox, Safari support
- ✅ **Mobile Support**: Responsive design testing
- ✅ **API Integration**: Direct API testing and validation
- ✅ **Error Recovery**: Graceful failure handling

**Total Tests**: ~50+ individual test cases covering all major functionality
**Browsers Supported**: 5 (Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari)
**Test Data Management**: Fully automated with cleanup
**CI/CD Ready**: Includes configuration for popular CI systems