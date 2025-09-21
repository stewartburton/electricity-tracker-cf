# ⚡ Electricity Tracker - Cloudflare Workers Edition

A modern **multi-tenant SaaS application** for tracking prepaid electricity usage, built with Cloudflare Workers and D1 database. Features a beautiful amber-themed UI with clean hover effects, animated backgrounds, and comprehensive family account management with invite codes and data export.

![Electricity Tracker Dashboard](https://img.shields.io/badge/Status-Active-green) 
![Cloudflare Workers](https://img.shields.io/badge/Platform-Cloudflare%20Workers-orange)
![D1 Database](https://img.shields.io/badge/Database-D1-blue)
![Modern UI](https://img.shields.io/badge/UI-Modern%20Amber%20Theme-amber)

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Git
- Cloudflare account

### Setup
```bash
# Clone the repository
git clone https://github.com/stewartburton/electricity-tracker-cf.git
cd electricity-tracker-cf

# Install dependencies
npm install

# Start development server
npx wrangler dev
```

Visit `http://localhost:8787` to view the application.

### Deploy to Production
```bash
# Deploy to Cloudflare Workers
npx wrangler deploy
```

## 🔑 Important Information

### Authentication
- **Registration Key**: Required for account creation (contact administrator)
- **User Accounts**: Self-registration with secure key validation

### Cloudflare Resources
- **Database Name**: `electricity-tracker-db`
- **Worker Name**: `electricity-tracker`
- **Account ID**: Contact administrator for deployment credentials
- **D1 Database ID**: Contact administrator for database access

### Project Structure
```
electricity-tracker-cf/
├── src/
│   └── index.js              # Worker backend code
├── public/
│   ├── login.html            # Login page
│   ├── register.html         # Registration page
│   ├── dashboard.html        # Dashboard with analytics
│   ├── voucher.html          # Voucher entry with SMS parsing
│   ├── reading.html          # Meter reading entry
│   ├── history.html          # Transaction history
│   ├── settings.html         # Account & household management
│   ├── api-config.js         # API configuration
│   ├── css/
│   │   └── styles.css        # Modern amber theme with animations
│   └── js/
│       ├── app.js            # Core frontend JavaScript
│       └── theme-effects.js  # Background beams & clean hover effects
├── migrations/
│   ├── 001_multi_tenant.sql  # Multi-tenant database schema
│   └── 002_invite_codes.sql  # Invite codes table
├── tests/
│   └── test.spec.js          # Playwright tests
├── package.json              # Dependencies
├── wrangler.toml             # Cloudflare config
├── .gitignore               # Git ignore rules
└── README.md                # Documentation
```

## ✨ Features

### 🎨 Modern UI/UX
- **Amber-themed design** using OKLCH color space for vibrant, accessible colors
- **Animated background beams** with SVG gradients and smooth animations
- **Clean card hover effects** with subtle scaling and glow on mouse interaction
- **Responsive mobile navigation** with hamburger menu for all screen sizes
- **Glassmorphism effects** with backdrop blur and translucent elements
- **Professional typography** with proper visual hierarchy and spacing

### 🔧 Core Functionality

- ✅ **User Authentication** - Secure login/register system with JWT tokens
- ✅ **Multi-Tenant Architecture** - Complete data isolation between family accounts
- ✅ **Invite Code System** - Secure family member onboarding with expirable codes
- ✅ **Data Export** - GDPR-compliant data export for user data portability
- ✅ **Voucher Management** - Track electricity voucher purchases with full details
- ✅ **SMS Import** - Quick voucher entry from FNB SMS messages with smart parsing
- ✅ **Meter Readings** - Record and track electricity meter readings over time
- ✅ **Dashboard Analytics** - Visual stats, consumption trends, and monthly breakdowns
- ✅ **Transaction History** - Detailed tabbed view with filtering and search
- ✅ **Monthly Reports** - Track spending patterns with proportional chart scaling
- ✅ **Smart Tooltips** - Chart tooltips with boundary detection and positioning
- ✅ **Notes System** - Add contextual notes to vouchers and readings
- ✅ **Mobile Responsive** - Full mobile navigation and optimized layouts
- ✅ **South African Support** - Timezone, currency, and FNB SMS formatting

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

#### Account Management
- `GET /api/account/info` - Get account and tenant information
- `POST /api/account/change-password` - Change user password

#### Tenant Management
- `POST /api/tenants/invite` - Generate invite code for family members
- `POST /api/tenants/join` - Join family account using invite code
- `GET /api/export/data` - Export all tenant data (GDPR compliant)

#### Vouchers
- `GET /api/vouchers` - List vouchers (household-aware)
- `POST /api/vouchers` - Create voucher
- `POST /api/vouchers/parse-sms` - Parse FNB SMS text automatically

#### Readings
- `GET /api/readings` - List readings (household-aware)
- `POST /api/readings` - Create reading

#### Dashboard & Analytics
- `GET /api/dashboard` - Dashboard data with household aggregation
- `GET /api/analytics` - Analytics data with consumption trends
- `GET /api/transactions` - Combined transactions with filtering

## 🛠️ Troubleshooting

### Common Issues

1. **CSS parsing errors (JSON unexpected token)**
   - Ensure CSS variables don't use `rgba(var(--variable))` syntax
   - Use direct color values or proper CSS custom property syntax

2. **Mobile navigation not visible**
   - All pages now include hamburger menu with responsive design
   - Check that `theme-effects.js` is included on all pages

3. **Interactive effects not working**
   - Ensure `theme-effects.js` is loaded and DOM is ready
   - Check browser console for JavaScript errors

4. **Authentication errors**
   - Clear localStorage and login again
   - Ensure you have the correct registration key from administrator

5. **Deployment fails**
   - Ensure wrangler is installed: `npm install wrangler --save-dev`
   - Check you're logged in: `npx wrangler login`

6. **Tests failing**
   - Run `npm test` to verify all functionality
   - Check that theme effects don't interfere with test selectors

## 📝 Development

### Local Development
```bash
npx wrangler dev
```
Access at: http://localhost:8787

### Testing
```bash
# Run all tests
npm test

# Run tests in UI mode
npm run test:ui

# Run tests in debug mode
npm run test:debug
```

### View Logs
```bash
npm run tail
```

### Database Management
The D1 database is managed through Cloudflare's dashboard or wrangler CLI:
```bash
# Execute SQL
npx wrangler d1 execute electricity-tracker-db --sql="SELECT * FROM users"

# Run migrations
npx wrangler d1 execute electricity-tracker-db --file=./migrations/001_init.sql

# View database schema
npx wrangler d1 execute electricity-tracker-db --sql=".schema"
```

## 📱 User Interface

### 🎨 Design Highlights

#### Amber Theme & Modern Aesthetics
- **OKLCH Color Space** - Advanced color system for vibrant, accessible colors
- **Amber Accent Colors** - Warm, professional color palette throughout
- **Glassmorphism Effects** - Translucent cards with backdrop blur
- **Smooth Animations** - 60fps animations using CSS transforms

#### Interactive Elements
- **Clean Card Effects** - Subtle hover scaling and mouse-tracking glow effects
- **Background Beams** - Animated SVG gradients with flowing beam effects
- **Hover Feedback** - Gentle scale and glow effects on interactive elements
- **Mobile Touch** - Optimized touch interactions for mobile devices

#### Responsive Design
- **Mobile-First** - Hamburger navigation and optimized layouts
- **Breakpoint System** - Smooth transitions between desktop and mobile
- **Touch-Friendly** - Large touch targets and gesture support
- **Cross-Browser** - Modern CSS with fallbacks for compatibility

### 📟 Page Overview

#### Login & Registration
- Clean authentication forms with branded styling
- Real-time validation and user feedback
- Secure JWT token-based authentication
- Registration key protection

#### Dashboard Analytics
- **Statistics Overview** - Total spending, kWh consumed, cost per unit
- **Monthly Charts** - Interactive consumption and spending trends
- **Recent Activity** - Latest vouchers and readings with quick actions
- **Smart Tooltips** - Chart tooltips with boundary detection

#### Voucher Management
- **SMS Parser** - Automatic FNB SMS parsing with one click
- **Manual Entry** - Clean, validated forms for manual input
- **Purchase History** - Complete voucher transaction log
- **Token Management** - Credit token tracking and validation

#### Meter Readings
- **Simple Input** - Streamlined reading entry with helpful tips
- **Historical Context** - Previous readings and consumption calculations
- **Usage Trends** - Visual consumption patterns over time
- **Validation** - Smart checks for reading accuracy

#### Transaction History
- **Tabbed Interface** - Separate views for vouchers, readings, or combined
- **Advanced Filtering** - Date range, amount, and text search
- **Detailed Tables** - Sortable columns with comprehensive data
- **Export Options** - Data export capabilities

#### Family Account Management
- **Multi-Tenant Architecture** - Complete data isolation between family accounts
- **Invite Code System** - Generate secure invite codes for family members
  - Configurable expiration dates (default: 7 days)
  - Usage limits and tracking
  - Automatic code generation with crypto-secure randomness
- **Data Export** - GDPR-compliant export of all family account data
  - JSON format with complete transaction history
  - Includes vouchers, readings, and account information
  - One-click download functionality
- **Password Management** - Secure password changes with validation
- **Tenant Administration** - Family account admins can manage members

## 🔄 Recent Updates (v4.0 - Multi-Tenant SaaS)

### 🏢 Multi-Tenant Architecture
- ✅ **Complete Data Isolation** - Tenant-based data segregation with automatic filtering
- ✅ **Invite Code System** - Secure family member onboarding with configurable expiration
- ✅ **GDPR Data Export** - Complete user data portability and compliance
- ✅ **Auto-Tenant Creation** - New users automatically get their own family account
- ✅ **Database Migration** - Seamless migration from single-user to multi-tenant
- ✅ **Tenant Middleware** - Automatic tenant isolation for all API endpoints

### 🛡️ Security & Data Protection
The application now implements enterprise-grade multi-tenancy with:

#### Tenant Isolation
- **Database Level**: All data tables include `tenant_id` for automatic filtering
- **Middleware Level**: Tenant context automatically applied to all API requests
- **Frontend Level**: Users only see data belonging to their family account
- **Complete Separation**: Zero data leakage between family accounts

#### Invite Code Security
- **Crypto-Secure Generation**: Uses Node.js crypto.randomBytes for code generation
- **Expiration Control**: Configurable expiration dates (default 7 days)
- **Usage Tracking**: Limits and monitoring for invite code usage
- **Admin Controls**: Only family admins can generate invite codes

#### Data Export Compliance
- **GDPR Compliant**: Complete user data portability
- **JSON Format**: Structured export including all vouchers, readings, and account data
- **Audit Trail**: Export actions are logged for compliance
- **Secure Download**: Direct browser download with proper headers

### 🔧 Technical Implementation

#### Database Schema
```sql
-- Core multi-tenant tables
CREATE TABLE tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    subscription_status TEXT DEFAULT 'active',
    max_users INTEGER DEFAULT 5
);

CREATE TABLE tenant_users (
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member', -- 'admin', 'member'
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    UNIQUE(tenant_id, user_id)
);

CREATE TABLE invite_codes (
    tenant_id INTEGER NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER NOT NULL,
    expires_at DATETIME,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1
);

-- All existing tables now include tenant_id
ALTER TABLE vouchers ADD COLUMN tenant_id INTEGER;
ALTER TABLE readings ADD COLUMN tenant_id INTEGER;
```

#### Automatic Migration Process
1. **Backup Creation**: Automatic database backup before migration
2. **Schema Updates**: Add multi-tenant tables and columns
3. **Data Migration**: Convert existing users to individual tenants
4. **Index Creation**: Performance optimization indexes
5. **Verification**: Complete data integrity checks

## 🔄 Previous Updates (v3.0)

### 🎨 Major UI Overhaul
- ✅ **Amber Theme Implementation** - Complete redesign with OKLCH color system
- ✅ **Background Beams** - Animated SVG gradients with flowing light effects
- ✅ **Clean Card Hover Effects** - Subtle scaling and glow effects without distracting rotations
- ✅ **Mobile Navigation** - Hamburger menus implemented across all pages
- ✅ **Theme Effects System** - Modular JavaScript for consistent animations

### 🚀 Feature Enhancements
- ✅ **Multi-Tenant SaaS Architecture** - Complete transformation to commercial-ready platform
- ✅ **Invite Code System** - Secure family member onboarding with expirable codes
- ✅ **Data Export Functionality** - GDPR-compliant data portability
- ✅ **Tenant Isolation** - Complete data separation between family accounts
- ✅ **Auto-Tenant Creation** - Seamless onboarding for new users
- ✅ **Smart Chart Scaling** - Proportional chart scaling to show true differences
- ✅ **Tooltip Positioning** - Smart boundary detection for chart tooltips
- ✅ **SMS Parsing** - Enhanced FNB SMS parsing with better error handling

### 🛠️ Technical Improvements
- ✅ **CSS Variable System** - Consistent theming with CSS custom properties
- ✅ **Responsive Breakpoints** - Mobile-first design with smooth transitions
- ✅ **Performance Optimization** - Efficient animations using transform and opacity
- ✅ **Cross-Browser Support** - Modern CSS with graceful fallbacks
- ✅ **Test Coverage** - Comprehensive Playwright tests covering all functionality

## 📧 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the Cloudflare Workers documentation
3. Check your browser console for errors

---

## 🏗️ Built With

- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Serverless runtime with global edge deployment
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - Serverless SQLite database
- **Vanilla JavaScript** - Framework-free frontend for maximum performance
- **Modern CSS3** - OKLCH colors, CSS Grid, Flexbox, and custom properties
- **SVG Animations** - Hardware-accelerated graphics with gradient effects
- **JWT Authentication** - Secure stateless user sessions
- **[Playwright](https://playwright.dev/)** - End-to-end testing framework

## 📊 Performance & Features

- **⚡ Ultra-fast loading** - Cloudflare's global edge network with sub-100ms response times
- **🔒 Secure by default** - HTTPS everywhere, JWT tokens, secure authentication
- **📱 Mobile-first** - Responsive design with touch-optimized interactions
- **🌍 Global scale** - Available worldwide with low latency edge computing
- **🎨 Smooth animations** - 60fps CSS animations using GPU acceleration
- **♿ Accessible design** - OKLCH color space ensures proper contrast ratios
- **🔋 Battery efficient** - Optimized animations and minimal JavaScript footprint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Last Updated**: September 2025
**Status**: ✅ Production Ready
**Version**: 4.0.0 - Multi-Tenant SaaS Platform Release  
**Live Demo**: [electricity-tracker.electricity-monitor.workers.dev](https://electricity-tracker.electricity-monitor.workers.dev)