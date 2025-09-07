# ⚡ Electricity Tracker - Cloudflare Workers Edition

A modern web application for tracking prepaid electricity usage, built with Cloudflare Workers and D1 database.

![Electricity Tracker Dashboard](https://img.shields.io/badge/Status-Active-green) 
![Cloudflare Workers](https://img.shields.io/badge/Platform-Cloudflare%20Workers-orange)
![D1 Database](https://img.shields.io/badge/Database-D1-blue)

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
- **Registration Key**: `electricity-tracker-2025`
- **Default Admin**: You'll need to register a new account

### Cloudflare Resources
- **Account ID**: `ea0f3f2a36d3e89033f96519ad115af1`
- **D1 Database ID**: `fbcc393d-4801-4fd1-a090-5dca1fa3ee92`
- **Database Name**: `electricity-tracker-db`
- **Worker Name**: `electricity-tracker`

### Project Structure
```
electricity-tracker-cf/
├── src/
│   └── index.js           # Worker backend code
├── public/
│   ├── index.html         # Login page
│   ├── dashboard.html     # Dashboard
│   ├── voucher.html       # Voucher entry
│   ├── reading.html       # Meter reading entry
│   ├── history.html       # Transaction history
│   ├── api-config.js      # API configuration
│   ├── css/
│   │   └── styles.css     # Styles
│   └── js/
│       └── app.js         # Frontend JavaScript
├── migrations/
│   └── 001_init.sql       # Database schema
├── package.json           # Dependencies
├── wrangler.toml          # Cloudflare config
├── .gitignore            # Git ignore rules
└── README.md             # Documentation
```

## ✨ Features

### 🎨 Modern UI/UX
- **Purple gradient theme** with glassmorphism effects
- **Responsive design** that works on desktop and mobile
- **Intuitive navigation** with emoji icons and pill-shaped buttons
- **Card-based layouts** with smooth animations and hover effects
- **Professional typography** with proper visual hierarchy

### 🔧 Core Functionality
✅ **User Authentication** - Secure login/register system
✅ **Voucher Management** - Track electricity voucher purchases
✅ **SMS Import** - Quick voucher entry from FNB SMS messages
✅ **Meter Readings** - Record and track electricity meter readings
✅ **Dashboard Analytics** - Visual stats and consumption trends
✅ **Transaction History** - Detailed view with filtering options
✅ **Monthly Reports** - Track spending and usage patterns
✅ **Notes System** - Add notes to vouchers and readings
✅ **South African Support** - Timezone and currency formatting

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

#### Vouchers
- `GET /api/vouchers` - List vouchers
- `POST /api/vouchers` - Create voucher
- `POST /api/vouchers/parse-sms` - Parse SMS text

#### Readings
- `GET /api/readings` - List readings
- `POST /api/readings` - Create reading

#### Dashboard & Analytics
- `GET /api/dashboard` - Dashboard data
- `GET /api/analytics` - Analytics data
- `GET /api/transactions` - Combined transactions

## 🛠️ Troubleshooting

### Common Issues

1. **"Identifier 'API_URL' has already been declared"**
   - Fixed by using the namespace approach in app.js

2. **Database missing notes columns**
   - Already fixed in your live database

3. **Authentication errors**
   - Clear localStorage and login again
   - Check registration key is correct

4. **Deployment fails**
   - Ensure wrangler is installed: `npm install wrangler --save-dev`
   - Check you're logged in: `npx wrangler login`

## 📝 Development

### Local Development
```bash
npm run dev
```
Access at: http://localhost:8787

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
```

## 📱 Screenshots

### Login Page
Clean, modern login interface with branded styling and secure authentication.

### Dashboard
Comprehensive overview with:
- **Statistics Cards** showing total spent, kWh consumed, and average cost
- **Monthly Breakdown** for the last 6 months
- **Usage Analytics** with recent vouchers and readings
- **Interactive Charts** for consumption trends

### Add Voucher
Streamlined voucher entry with:
- **SMS Import** - Paste FNB SMS for automatic parsing
- **Manual Entry** - Clean form for manual voucher details
- **Smart Validation** - Ensures data accuracy

### Add Reading
Simple meter reading entry with:
- **Current Reading Input** - Easy number entry
- **Tips Section** - Helpful guidance for accurate readings
- **Historical Context** - Shows previous readings

### History
Complete transaction overview:
- **Tabbed Interface** - Separate views for vouchers, readings, or combined
- **Detailed Table** - All transaction data in sortable columns
- **Filter Options** - Quick access to specific time periods

## 🔄 Recent Updates

- ✅ **Complete UI Redesign** - Modern purple gradient theme with glassmorphism
- ✅ **Responsive Navigation** - New navigation bar with brand logo and icons
- ✅ **Dashboard Overhaul** - Statistics cards, monthly summaries, and analytics
- ✅ **Enhanced Forms** - Improved voucher and reading entry interfaces
- ✅ **History Table** - Professional data table with filtering and sorting
- ✅ **Mobile Optimization** - Responsive design for all screen sizes
- ✅ **Visual Enhancements** - Emoji icons, hover effects, and smooth animations

## 📧 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the Cloudflare Workers documentation
3. Check your browser console for errors

---

## 🏗️ Built With

- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Serverless runtime
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - Serverless SQL database
- **Vanilla JavaScript** - Frontend framework-free for performance
- **Modern CSS** - Glassmorphism, gradients, and responsive design
- **JWT Authentication** - Secure user sessions

## 📊 Performance

- **⚡ Ultra-fast loading** - Cloudflare's global edge network
- **🔒 Secure by default** - HTTPS everywhere, JWT tokens
- **📱 Mobile-first** - Responsive design works on all devices
- **🌍 Global scale** - Available worldwide with low latency

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
**Version**: 2.0.0 - Modern UI Release