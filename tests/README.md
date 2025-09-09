# Electricity Tracker - Test Suite Quick Start

## 🚀 Run Tests Now

### Prerequisites Check
```bash
# Verify Playwright is ready
node tests/test-runner.js check
```

### Quick Test Commands

```bash
# Run all tests (recommended)
node tests/test-runner.js all

# Run specific test categories
node tests/test-runner.js auth        # Authentication tests
node tests/test-runner.js core        # Core functionality tests  
node tests/test-runner.js account     # Account management tests
node tests/test-runner.js smoke       # Quick smoke tests (5 min)

# Debug with browser visible
node tests/test-runner.js headed

# Interactive UI mode
node tests/test-runner.js ui
```

### Alternative Commands
```bash
# Standard npm commands
npm test                    # Run all tests
npm run test:headed         # Run with browser visible
npm run test:ui            # Run in UI mode
npm run test:debug         # Run in debug mode

# Direct Playwright commands
npx playwright test                           # Run all tests
npx playwright test tests/auth.spec.js       # Run specific file
npx playwright test --headed                 # With browser visible
npx playwright test --ui                     # Interactive UI
```

## 📊 View Results

```bash
# Open test report
node tests/test-runner.js report

# Or manually open
open test-results/index.html
```

## 🛠 Setup (One-time)

If you haven't set up yet:

```bash
# Install dependencies (already done)
npm install

# Install browsers (if not done)
npx playwright install

# Verify setup
node tests/test-runner.js check
```

## 🧹 Cleanup

```bash
# Clean up test results
node tests/test-runner.js clean
```

## ❓ Need Help?

```bash
# Show all available commands
node tests/test-runner.js help
```

See the main [TESTING.md](../TESTING.md) for complete documentation.

---

**Application URL**: https://electricity-tracker.electricity-monitor.workers.dev  
**Registration Key**: STU-KRISY-2025