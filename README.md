# ⚡ Electricity Tracker - Cloudflare Workers Edition

## 📋 Complete Recovery & Setup Instructions

### Prerequisites
- Node.js installed (v16 or higher)
- Git installed
- Windows Command Prompt or PowerShell

### Step 1: Create Project Structure
```bash
# Create and enter project directory
mkdir electricity-tracker-cf
cd electricity-tracker-cf

# Create folder structure
mkdir src
mkdir public
mkdir public\css
mkdir public\js
mkdir migrations
```

### Step 2: Initialize Project
```bash
# Initialize git
git init
git remote add origin https://github.com/stewartburton/electricity-tracker-cf.git

# Initialize npm and install dependencies
npm init -y
npm install wrangler --save-dev
```

### Step 3: Create Configuration Files

Create these files in the root directory:

**package.json** - Copy from artifact above
**wrangler.toml** - Copy from artifact above  
**.gitignore** - Copy from artifact above

### Step 4: Create Source Files

**src/index.js** - Copy the complete worker code from the "src/index.js - Your recovered Worker code" artifact

### Step 5: Create Frontend Files

In the `public` folder:
- **index.html** - Login page (copy from artifact)
- **dashboard.html** - Dashboard page (copy from artifact)
- **voucher.html** - Voucher entry page (copy from artifact)
- **reading.html** - Reading entry page (copy from artifact)
- **history.html** - Transaction history page (copy from artifact)
- **api-config.js** - API configuration (copy from artifact)

In the `public/css` folder:
- **styles.css** - Complete styles (copy from artifact)

In the `public/js` folder:
- **app.js** - Application JavaScript (copy from artifact)

### Step 6: Create Database Migration

In the `migrations` folder:
- **001_init.sql** - Database schema (copy from artifact)

### Step 7: Test Locally
```bash
# Test the application locally
npm run dev

# Open browser to http://localhost:8787
```

### Step 8: Deploy to Cloudflare
```bash
# Deploy to production
npm run deploy
```

### Step 9: Push to GitHub
```bash
# Add all files
git add .

# Commit
git commit -m "Recovery: Complete Electricity Tracker application restored"

# Push to GitHub
git push -u origin main
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

## 🚀 Features

### Implemented
✅ User authentication (login/register)
✅ Voucher management
✅ SMS parser for quick voucher import
✅ Meter readings tracking
✅ Dashboard with statistics
✅ Transaction history with filters
✅ Monthly analytics
✅ South African timezone support
✅ Notes on vouchers and readings

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

## 🔄 Updates Since Recovery

- ✅ Added notes columns to database tables
- ✅ Fixed duplicate API_URL declaration issue
- ✅ Created centralized app.js for better code organization
- ✅ Added comprehensive error handling
- ✅ Improved UI/UX with better styles
- ✅ Added transaction history with filters

## 📧 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the Cloudflare Workers documentation
3. Check your browser console for errors

---

**Recovery Date**: September 2025
**Status**: ✅ Fully Recovered and Functional