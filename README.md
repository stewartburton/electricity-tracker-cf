# ⚡ Electricity Tracker - Cloudflare Workers Edition

A modern web application for tracking prepaid electricity usage, built with Cloudflare Workers and D1 database. Features a beautiful amber-themed UI with interactive 3D effects, animated backgrounds, and comprehensive household management.

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
npm run dev
```

Visit `http://localhost:8787` to view the application.

### Deploy to Production
```bash
# Deploy to Cloudflare Workers
npm run deploy
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
│       └── theme-effects.js  # Background beams & 3D card effects
├── migrations/
│   └── 001_init.sql          # Database schema
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
- **Interactive 3D cards** with mouse tracking and transform effects
- **Responsive mobile navigation** with hamburger menu for all screen sizes
- **Glassmorphism effects** with backdrop blur and translucent elements
- **Professional typography** with proper visual hierarchy and spacing

### 🔧 Core Functionality
✅ **User Authentication** - Secure login/register system with JWT tokens
✅ **Household Management** - Create and join household groups to share data
✅ **Voucher Management** - Track electricity voucher purchases with full details
✅ **SMS Import** - Quick voucher entry from FNB SMS messages with smart parsing
✅ **Meter Readings** - Record and track electricity meter readings over time
✅ **Dashboard Analytics** - Visual stats, consumption trends, and monthly breakdowns
✅ **Transaction History** - Detailed tabbed view with filtering and search
✅ **Monthly Reports** - Track spending patterns with proportional chart scaling
✅ **Smart Tooltips** - Chart tooltips with boundary detection and positioning
✅ **Notes System** - Add contextual notes to vouchers and readings
✅ **Mobile Responsive** - Full mobile navigation and optimized layouts
✅ **South African Support** - Timezone, currency, and FNB SMS formatting

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

#### Account Management
- `GET /api/account/info` - Get account and household information
- `POST /api/account/change-password` - Change user password
- `POST /api/account/create-group` - Create new household group
- `POST /api/account/join-group` - Join existing household group
- `POST /api/account/leave-group` - Leave current household group

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
npm run dev
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

#### Interactive 3D Elements
- **Comet Cards** - Mouse-tracking 3D transform effects on interactive elements
- **Background Beams** - Animated SVG gradients with flowing beam effects
- **Hover Feedback** - Subtle scale and glow effects on interactive elements
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

#### Account Settings
- **Household Groups** - Create or join household accounts for data sharing
- **Password Management** - Secure password changes with validation
- **Account Linking** - Invite codes and group management
- **Profile Information** - Account details and preferences

## 🔄 Recent Updates (v3.0)

### 🎨 Major UI Overhaul
- ✅ **Amber Theme Implementation** - Complete redesign with OKLCH color system
- ✅ **Background Beams** - Animated SVG gradients with flowing light effects
- ✅ **Interactive 3D Cards** - Mouse-tracking transform effects on all card elements
- ✅ **Mobile Navigation** - Hamburger menus implemented across all pages
- ✅ **Theme Effects System** - Modular JavaScript for consistent animations

### 🚀 Feature Enhancements
- ✅ **Household Management** - Create and join household groups for data sharing
- ✅ **Smart Chart Scaling** - Proportional chart scaling to show true differences
- ✅ **Tooltip Positioning** - Smart boundary detection for chart tooltips
- ✅ **SMS Parsing** - Enhanced FNB SMS parsing with better error handling
- ✅ **Account Settings** - Complete password management and group controls

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
**Status**: ✅ Active Development  
**Version**: 3.0.0 - Amber Theme & Interactive Effects Release  
**Live Demo**: [electricity-tracker.electricity-monitor.workers.dev](https://electricity-tracker.electricity-monitor.workers.dev)