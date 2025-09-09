#!/usr/bin/env node

/**
 * Pre-commit hook to run smoke tests
 * This ensures basic functionality works before committing changes
 */

const { execSync } = require('child_process');
const { TestRunner } = require('../tests/test-runner');

async function runPreCommitTests() {
  console.log('🔍 Running pre-commit tests...');
  
  const runner = new TestRunner();
  
  try {
    // Check if Playwright is properly installed
    await runner.checkInstallation();
    
    // Run smoke tests (quick validation)
    await runner.runSmokeTests();
    
    console.log('✅ Pre-commit tests passed. Proceeding with commit...');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Pre-commit tests failed. Commit aborted.');
    console.log('Fix the failing tests before committing.');
    console.log('Run `node tests/test-runner.js smoke` to debug.');
    process.exit(1);
  }
}

if (require.main === module) {
  runPreCommitTests().catch(console.error);
}

module.exports = { runPreCommitTests };