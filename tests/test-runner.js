const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive Test Runner for Electricity Tracker
 * Provides various test execution options and cleanup utilities
 */

class TestRunner {
  constructor() {
    this.testResultsDir = 'test-results';
    this.screenshotsDir = path.join(this.testResultsDir, 'screenshots');
    this.setupDirectories();
  }

  setupDirectories() {
    // Ensure test results directories exist
    if (!fs.existsSync(this.testResultsDir)) {
      fs.mkdirSync(this.testResultsDir, { recursive: true });
    }
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Running all Playwright tests...');
    
    try {
      execSync('npx playwright test', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ All tests completed successfully');
    } catch (error) {
      console.error('❌ Some tests failed');
      console.log('📊 Check test-results/index.html for detailed report');
      process.exit(1);
    }
  }

  /**
   * Run tests in headed mode (with browser visible)
   */
  async runTestsHeaded() {
    console.log('🚀 Running tests in headed mode...');
    
    try {
      execSync('npx playwright test --headed', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Headed tests completed successfully');
    } catch (error) {
      console.error('❌ Some headed tests failed');
      process.exit(1);
    }
  }

  /**
   * Run tests with UI mode
   */
  async runTestsUI() {
    console.log('🚀 Running tests in UI mode...');
    
    try {
      execSync('npx playwright test --ui', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      console.error('❌ UI tests failed');
      process.exit(1);
    }
  }

  /**
   * Run specific test file
   */
  async runSpecificTest(testFile) {
    console.log(`🚀 Running specific test: ${testFile}`);
    
    try {
      execSync(`npx playwright test ${testFile}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log(`✅ Test ${testFile} completed successfully`);
    } catch (error) {
      console.error(`❌ Test ${testFile} failed`);
      process.exit(1);
    }
  }

  /**
   * Run tests for specific browser
   */
  async runTestsForBrowser(browser) {
    console.log(`🚀 Running tests for ${browser}...`);
    
    try {
      execSync(`npx playwright test --project=${browser}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log(`✅ Tests for ${browser} completed successfully`);
    } catch (error) {
      console.error(`❌ Tests for ${browser} failed`);
      process.exit(1);
    }
  }

  /**
   * Run only authentication tests
   */
  async runAuthTests() {
    console.log('🔐 Running authentication tests...');
    await this.runSpecificTest('tests/auth.spec.js');
  }

  /**
   * Run only core functionality tests
   */
  async runCoreTests() {
    console.log('⚡ Running core functionality tests...');
    await this.runSpecificTest('tests/core-functionality.spec.js');
  }

  /**
   * Run only account management tests
   */
  async runAccountTests() {
    console.log('👥 Running account management tests...');
    await this.runSpecificTest('tests/account-management.spec.js');
  }

  /**
   * Run only cleanup tests
   */
  async runCleanupTests() {
    console.log('🧹 Running data cleanup tests...');
    await this.runSpecificTest('tests/data-cleanup.spec.js');
  }

  /**
   * Clean up test results and artifacts
   */
  cleanupResults() {
    console.log('🧹 Cleaning up test results...');
    
    if (fs.existsSync(this.testResultsDir)) {
      fs.rmSync(this.testResultsDir, { recursive: true, force: true });
    }
    
    // Remove other potential artifacts
    const artifactFiles = [
      'test-results.json',
      'test-results.xml',
      'playwright-report'
    ];
    
    artifactFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.rmSync(file, { recursive: true, force: true });
      }
    });
    
    console.log('✅ Test results cleaned up');
  }

  /**
   * Generate test report
   */
  async generateReport() {
    console.log('📊 Generating test report...');
    
    try {
      execSync('npx playwright show-report', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      console.error('❌ Failed to generate report');
      console.log('Report files might not exist. Run tests first.');
    }
  }

  /**
   * Install Playwright browsers
   */
  async installBrowsers() {
    console.log('🌐 Installing Playwright browsers...');
    
    try {
      execSync('npx playwright install', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Browsers installed successfully');
    } catch (error) {
      console.error('❌ Failed to install browsers');
      process.exit(1);
    }
  }

  /**
   * Check Playwright installation
   */
  async checkInstallation() {
    console.log('🔍 Checking Playwright installation...');
    
    try {
      execSync('npx playwright --version', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Playwright is properly installed');
    } catch (error) {
      console.error('❌ Playwright is not properly installed');
      console.log('Run: npm install @playwright/test');
      console.log('Then: npx playwright install');
      process.exit(1);
    }
  }

  /**
   * Run smoke tests (quick validation)
   */
  async runSmokeTests() {
    console.log('💨 Running smoke tests...');
    
    try {
      // Run a subset of critical tests quickly
      execSync('npx playwright test auth.spec.js --grep "should successfully register|should successfully login"', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Smoke tests passed');
    } catch (error) {
      console.error('❌ Smoke tests failed');
      process.exit(1);
    }
  }

  /**
   * Show available commands
   */
  showHelp() {
    console.log(`
📖 Electricity Tracker Test Runner

Available commands:
  all              - Run all tests
  auth             - Run authentication tests only
  core             - Run core functionality tests only  
  account          - Run account management tests only
  cleanup          - Run data cleanup tests only
  smoke            - Run smoke tests (quick validation)
  headed           - Run tests with browser visible
  ui               - Run tests in UI mode
  browser <name>   - Run tests for specific browser (chromium/firefox/webkit)
  test <file>      - Run specific test file
  install          - Install Playwright browsers
  check            - Check Playwright installation
  report           - Show test report
  clean            - Clean up test results
  help             - Show this help

Examples:
  node tests/test-runner.js all
  node tests/test-runner.js auth
  node tests/test-runner.js headed
  node tests/test-runner.js browser chromium
  node tests/test-runner.js test auth.spec.js

Test Results:
  - HTML Report: test-results/index.html
  - Screenshots: test-results/screenshots/
  - JSON Results: test-results.json
    `);
  }
}

// CLI Interface
async function main() {
  const runner = new TestRunner();
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'all':
      await runner.runAllTests();
      break;
    case 'auth':
      await runner.runAuthTests();
      break;
    case 'core':
      await runner.runCoreTests();
      break;
    case 'account':
      await runner.runAccountTests();
      break;
    case 'cleanup':
      await runner.runCleanupTests();
      break;
    case 'smoke':
      await runner.runSmokeTests();
      break;
    case 'headed':
      await runner.runTestsHeaded();
      break;
    case 'ui':
      await runner.runTestsUI();
      break;
    case 'browser':
      if (!arg) {
        console.error('Please specify browser: chromium, firefox, or webkit');
        process.exit(1);
      }
      await runner.runTestsForBrowser(arg);
      break;
    case 'test':
      if (!arg) {
        console.error('Please specify test file');
        process.exit(1);
      }
      await runner.runSpecificTest(arg);
      break;
    case 'install':
      await runner.installBrowsers();
      break;
    case 'check':
      await runner.checkInstallation();
      break;
    case 'report':
      await runner.generateReport();
      break;
    case 'clean':
      runner.cleanupResults();
      break;
    case 'help':
    default:
      runner.showHelp();
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { TestRunner };