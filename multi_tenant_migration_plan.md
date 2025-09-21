# Multi-Tenant Migration Plan - Electricity Tracker

## Executive Summary

This document outlines the transformation of the electricity tracker from a single-tenant application to a multi-tenant SaaS product with proper data isolation, invite codes, and data export capabilities.

## Current State Analysis

**Problems Identified:**
- ❌ No data isolation between users
- ❌ Users can access each other's data
- ❌ No tenant management system
- ❌ No invite/family account linking
- ❌ No data export functionality
- ❌ Single SQLite database for all users

**Current Architecture:**
- Node.js + Express.js backend
- SQLite database
- JWT authentication
- No tenant isolation middleware

## Recommended Multi-Tenancy Approach

### Phase 1: Shared Database with Tenant Isolation (Immediate Fix)
- Add `tenant_id` to all data tables
- Implement middleware for automatic tenant filtering
- Add invite code system for family accounts
- Maintain single SQLite database initially

### Phase 2: Database Per Tenant (Future Scaling)
- Migrate to individual SQLite files per tenant
- Implement dynamic database connection routing
- Enhanced security and isolation

**Why This Approach:**
- ✅ Quick implementation (Phase 1)
- ✅ Maintains current simplicity
- ✅ Provides immediate data isolation
- ✅ Scales to thousands of users
- ✅ Easy rollback if issues arise
- ✅ Progressive enhancement path

## Implementation Plan

### Step 1: Database Schema Migration

#### 1.1 Create New Tables
```sql
-- Create tenants table
CREATE TABLE tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    subscription_status TEXT DEFAULT 'active',
    max_users INTEGER DEFAULT 5
);

-- Create tenant_users junction table
CREATE TABLE tenant_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member', -- 'admin', 'member'
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(tenant_id, user_id)
);

-- Create invite codes table
CREATE TABLE invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### 1.2 Modify Existing Tables
```sql
-- Add tenant_id to existing tables
ALTER TABLE vouchers ADD COLUMN tenant_id INTEGER;
ALTER TABLE readings ADD COLUMN tenant_id INTEGER;

-- Create indexes for performance
CREATE INDEX idx_vouchers_tenant_id ON vouchers(tenant_id);
CREATE INDEX idx_readings_tenant_id ON readings(tenant_id);
CREATE INDEX idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user_id ON tenant_users(user_id);
```

### Step 2: Backend Code Changes

#### 2.1 Create Tenant Middleware (`middleware/tenantMiddleware.js`)
```javascript
const db = require('../db');

const tenantMiddleware = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Get user's tenant
        const tenantUser = db.prepare(`
            SELECT t.*, tu.role 
            FROM tenants t 
            JOIN tenant_users tu ON t.id = tu.tenant_id 
            WHERE tu.user_id = ?
        `).get(req.user.id);

        if (!tenantUser) {
            return res.status(403).json({ error: 'No tenant access' });
        }

        req.tenant = {
            id: tenantUser.id,
            name: tenantUser.name,
            role: tenantUser.role,
            subscription_status: tenantUser.subscription_status
        };

        next();
    } catch (error) {
        console.error('Tenant middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = tenantMiddleware;
```

#### 2.2 Update Database Queries
```javascript
// Example: Update vouchers controller
// Before: SELECT * FROM vouchers WHERE user_id = ?
// After: SELECT * FROM vouchers WHERE tenant_id = ?

// vouchers.js controller updates
const getVouchers = (req, res) => {
    try {
        const vouchers = db.prepare(`
            SELECT * FROM vouchers 
            WHERE tenant_id = ? 
            ORDER BY date DESC
        `).all(req.tenant.id);
        
        res.json(vouchers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch vouchers' });
    }
};

const createVoucher = (req, res) => {
    try {
        const { amount, date, voucher_number } = req.body;
        
        const result = db.prepare(`
            INSERT INTO vouchers (tenant_id, amount, date, voucher_number, created_by)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.tenant.id, amount, date, voucher_number, req.user.id);
        
        res.json({ id: result.lastInsertRowid, message: 'Voucher created' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create voucher' });
    }
};
```

#### 2.3 Create Tenant Management Controller (`controllers/tenants.js`)
```javascript
const db = require('../db');
const crypto = require('crypto');

// Create invite code
const createInviteCode = (req, res) => {
    try {
        if (req.tenant.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const code = crypto.randomBytes(8).toString('hex').toUpperCase();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const result = db.prepare(`
            INSERT INTO invite_codes (tenant_id, code, created_by, expires_at)
            VALUES (?, ?, ?, ?)
        `).run(req.tenant.id, code, req.user.id, expiresAt.toISOString());

        res.json({ 
            code, 
            expires_at: expiresAt,
            id: result.lastInsertRowid 
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create invite code' });
    }
};

// Join tenant via invite code
const joinTenant = (req, res) => {
    try {
        const { code } = req.body;

        // Validate invite code
        const invite = db.prepare(`
            SELECT * FROM invite_codes 
            WHERE code = ? AND is_active = 1 
            AND expires_at > datetime('now')
            AND current_uses < max_uses
        `).get(code);

        if (!invite) {
            return res.status(400).json({ error: 'Invalid or expired invite code' });
        }

        // Check if user already in tenant
        const existing = db.prepare(`
            SELECT id FROM tenant_users 
            WHERE tenant_id = ? AND user_id = ?
        `).get(invite.tenant_id, req.user.id);

        if (existing) {
            return res.status(400).json({ error: 'Already member of this tenant' });
        }

        // Add user to tenant
        db.prepare(`
            INSERT INTO tenant_users (tenant_id, user_id, role)
            VALUES (?, ?, 'member')
        `).run(invite.tenant_id, req.user.id);

        // Update invite usage
        db.prepare(`
            UPDATE invite_codes 
            SET current_uses = current_uses + 1
            WHERE id = ?
        `).run(invite.id);

        res.json({ message: 'Successfully joined tenant' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to join tenant' });
    }
};

module.exports = {
    createInviteCode,
    joinTenant
};
```

#### 2.4 Data Export Controller (`controllers/export.js`)
```javascript
const db = require('../db');
const fs = require('fs');
const path = require('path');

const exportUserData = (req, res) => {
    try {
        // Get all tenant data
        const vouchers = db.prepare(`
            SELECT * FROM vouchers WHERE tenant_id = ?
        `).all(req.tenant.id);

        const readings = db.prepare(`
            SELECT * FROM readings WHERE tenant_id = ?
        `).all(req.tenant.id);

        const tenantInfo = db.prepare(`
            SELECT t.*, GROUP_CONCAT(u.email) as members
            FROM tenants t
            JOIN tenant_users tu ON t.id = tu.tenant_id
            JOIN users u ON tu.user_id = u.id
            WHERE t.id = ?
            GROUP BY t.id
        `).get(req.tenant.id);

        const exportData = {
            export_date: new Date().toISOString(),
            tenant: tenantInfo,
            vouchers,
            readings,
            summary: {
                total_vouchers: vouchers.length,
                total_readings: readings.length,
                total_amount_spent: vouchers.reduce((sum, v) => sum + v.amount, 0)
            }
        };

        // Set headers for download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="electricity-data-${req.tenant.id}-${Date.now()}.json"`);
        
        res.json(exportData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export data' });
    }
};

module.exports = {
    exportUserData
};
```

### Step 3: Frontend Updates

#### 3.1 Add Tenant Management UI (`frontend/html/tenant-settings.html`)
```html
<!DOCTYPE html>
<html>
<head>
    <title>Tenant Settings - Electricity Tracker</title>
    <link rel="stylesheet" href="../css/styles.css">
</head>
<body>
    <div class="container">
        <h1>Family Account Settings</h1>
        
        <!-- Current Members -->
        <section class="members-section">
            <h2>Family Members</h2>
            <div id="members-list"></div>
        </section>

        <!-- Invite Codes -->
        <section class="invite-section">
            <h2>Invite Family Members</h2>
            <button id="generate-invite" class="btn btn-primary">Generate Invite Code</button>
            <div id="invite-codes"></div>
        </section>

        <!-- Data Export -->
        <section class="export-section">
            <h2>Export Data</h2>
            <p>Download all your electricity tracking data</p>
            <button id="export-data" class="btn btn-secondary">Export All Data</button>
        </section>
    </div>

    <script src="../js/tenant-settings.js"></script>
</body>
</html>
```

#### 3.2 Tenant Settings JavaScript (`frontend/js/tenant-settings.js`)
```javascript
// Generate invite code
document.getElementById('generate-invite').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/tenants/invite', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (response.ok) {
            displayInviteCode(data.code, data.expires_at);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Failed to generate invite code');
    }
});

// Export data
document.getElementById('export-data').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/export/data', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `electricity-data-${Date.now()}.json`;
            a.click();
        } else {
            alert('Failed to export data');
        }
    } catch (error) {
        alert('Export failed');
    }
});

function displayInviteCode(code, expiresAt) {
    const inviteDiv = document.getElementById('invite-codes');
    const expires = new Date(expiresAt).toLocaleDateString();
    
    inviteDiv.innerHTML += `
        <div class="invite-code">
            <strong>Invite Code: ${code}</strong>
            <p>Expires: ${expires}</p>
            <button onclick="copyToClipboard('${code}')">Copy Code</button>
        </div>
    `;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Invite code copied to clipboard!');
    });
}
```

### Step 4: Registration & Authentication Updates

#### 4.1 Update Registration Process (`controllers/auth.js`)
```javascript
const register = async (req, res) => {
    try {
        const { email, password, inviteCode } = req.body;
        
        // Create user (existing logic)
        const hashedPassword = await bcrypt.hash(password, 12);
        const userResult = db.prepare(`
            INSERT INTO users (email, password)
            VALUES (?, ?)
        `).run(email, hashedPassword);

        const userId = userResult.lastInsertRowid;

        if (inviteCode) {
            // Join existing tenant via invite
            const invite = db.prepare(`
                SELECT * FROM invite_codes 
                WHERE code = ? AND is_active = 1 
                AND expires_at > datetime('now')
                AND current_uses < max_uses
            `).get(inviteCode);

            if (invite) {
                db.prepare(`
                    INSERT INTO tenant_users (tenant_id, user_id, role)
                    VALUES (?, ?, 'member')
                `).run(invite.tenant_id, userId);

                db.prepare(`
                    UPDATE invite_codes 
                    SET current_uses = current_uses + 1
                    WHERE id = ?
                `).run(invite.id);
            }
        } else {
            // Create new tenant for user
            const tenantResult = db.prepare(`
                INSERT INTO tenants (name)
                VALUES (?)
            `).run(`${email}'s Family`);

            db.prepare(`
                INSERT INTO tenant_users (tenant_id, user_id, role)
                VALUES (?, ?, 'admin')
            `).run(tenantResult.lastInsertRowid, userId);
        }

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
};
```

### Step 5: Data Migration Script

#### 5.1 Migration Script (`scripts/migrate-to-multi-tenant.js`)
```javascript
const db = require('../src/backend/db');

function migrateToMultiTenant() {
    console.log('Starting multi-tenant migration...');

    try {
        // Create new tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS tenants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                subscription_status TEXT DEFAULT 'active',
                max_users INTEGER DEFAULT 5
            );

            CREATE TABLE IF NOT EXISTS tenant_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT DEFAULT 'member',
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(tenant_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS invite_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                code TEXT UNIQUE NOT NULL,
                created_by INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                max_uses INTEGER DEFAULT 1,
                current_uses INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );
        `);

        // Add tenant_id columns to existing tables
        try {
            db.exec('ALTER TABLE vouchers ADD COLUMN tenant_id INTEGER');
        } catch (e) {
            console.log('tenant_id column already exists in vouchers');
        }

        try {
            db.exec('ALTER TABLE readings ADD COLUMN tenant_id INTEGER');
        } catch (e) {
            console.log('tenant_id column already exists in readings');
        }

        // Create tenant for each existing user and migrate their data
        const users = db.prepare('SELECT * FROM users').all();
        
        for (const user of users) {
            // Create tenant
            const tenantResult = db.prepare(`
                INSERT INTO tenants (name)
                VALUES (?)
            `).run(`${user.email}'s Family`);

            const tenantId = tenantResult.lastInsertRowid;

            // Link user to tenant as admin
            db.prepare(`
                INSERT INTO tenant_users (tenant_id, user_id, role)
                VALUES (?, ?, 'admin')
            `).run(tenantId, user.id);

            // Update user's vouchers
            db.prepare(`
                UPDATE vouchers SET tenant_id = ? WHERE user_id = ?
            `).run(tenantId, user.id);

            // Update user's readings
            db.prepare(`
                UPDATE readings SET tenant_id = ? WHERE user_id = ?
            `).run(tenantId, user.id);

            console.log(`Migrated user ${user.email} to tenant ${tenantId}`);
        }

        // Create indexes
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_id ON vouchers(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_readings_tenant_id ON readings(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
        `);

        console.log('Migration completed successfully!');
        console.log(`Migrated ${users.length} users to multi-tenant structure`);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateToMultiTenant();
```

### Step 6: Route Updates

#### 6.1 Update server.js Routes
```javascript
// Add tenant middleware to protected routes
const tenantMiddleware = require('./middleware/tenantMiddleware');
const tenantController = require('./controllers/tenants');
const exportController = require('./controllers/export');

// Apply tenant middleware to all data routes
app.use('/api/vouchers', authMiddleware, tenantMiddleware);
app.use('/api/readings', authMiddleware, tenantMiddleware);
app.use('/api/dashboard', authMiddleware, tenantMiddleware);

// New tenant management routes
app.post('/api/tenants/invite', authMiddleware, tenantMiddleware, tenantController.createInviteCode);
app.post('/api/tenants/join', authMiddleware, tenantController.joinTenant);
app.get('/api/export/data', authMiddleware, tenantMiddleware, exportController.exportUserData);
```

## Deployment Checklist

### Pre-Deployment
- [ ] Backup existing database
- [ ] Test migration script on copy of production data
- [ ] Update environment variables if needed
- [ ] Review all SQL queries for tenant isolation

### Deployment Steps
1. [ ] Stop the application
2. [ ] Backup database: `cp electricity_tracker.db electricity_tracker.db.backup`
3. [ ] Run migration script: `node scripts/migrate-to-multi-tenant.js`
4. [ ] Update application code
5. [ ] Start application
6. [ ] Test invite code functionality
7. [ ] Test data export functionality
8. [ ] Verify data isolation between tenants

### Post-Deployment Testing
- [ ] Create new user account (should create new tenant)
- [ ] Generate invite code and test joining
- [ ] Verify users only see their own data
- [ ] Test data export functionality
- [ ] Check dashboard analytics are tenant-scoped

## Scaling Considerations

### SQLite Limitations & When to Migrate
- **Stay with SQLite if:** < 1000 tenants, < 100GB total data
- **Consider PostgreSQL if:** > 1000 tenants, need advanced features
- **Consider Database-per-tenant if:** > 5000 tenants, strict isolation required

### Performance Optimizations
```sql
-- Add composite indexes for common queries
CREATE INDEX idx_vouchers_tenant_date ON vouchers(tenant_id, date DESC);
CREATE INDEX idx_readings_tenant_date ON readings(tenant_id, date DESC);

-- Analyze database periodically
ANALYZE;
```

### Future Enhancements
- [ ] Tenant billing/subscription management
- [ ] Advanced role-based permissions
- [ ] Tenant customization options
- [ ] Multi-database support for large scale
- [ ] Data retention policies per tenant

## Security Considerations

### Implemented Protections
- ✅ Automatic tenant isolation via middleware
- ✅ JWT token validation
- ✅ SQL injection prevention (parameterized queries)
- ✅ Invite code expiration and usage limits

### Additional Security Measures
- [ ] Rate limiting per tenant
- [ ] Audit logging for tenant actions
- [ ] Data encryption at rest
- [ ] Regular security assessments

## Cost Analysis

### Development Time Estimate
- **Phase 1 Implementation:** 2-3 days
- **Testing & Debugging:** 1-2 days
- **Frontend Updates:** 1 day
- **Total:** 4-6 days

### Ongoing Costs
- **Storage:** Minimal increase (new tables)
- **Performance:** 5-10% overhead for tenant filtering
- **Maintenance:** Low (automated tenant isolation)

## Success Metrics

### Technical Metrics
- [ ] Zero data leakage between tenants
- [ ] < 10ms additional latency for tenant filtering
- [ ] 100% test coverage for tenant isolation
- [ ] Successful data exports for all tenants

### Business Metrics
- [ ] Enable family account sharing
- [ ] Support invite-based onboarding
- [ ] Provide data portability compliance
- [ ] Foundation for subscription billing

## Rollback Plan

If issues arise:
1. Stop application
2. Restore backup: `cp electricity_tracker.db.backup electricity_tracker.db`
3. Deploy previous version
4. Investigate and fix issues
5. Re-attempt migration

## Conclusion

This migration plan transforms your electricity tracker into a commercial-ready multi-tenant application with:

- ✅ **Complete data isolation** between users/families
- ✅ **Invite code system** for family account management
- ✅ **Data export functionality** for user data portability
- ✅ **Scalable architecture** supporting thousands of users
- ✅ **Minimal performance impact** on existing functionality
- ✅ **Progressive enhancement** path for future scaling

The implementation maintains SQLite simplicity while adding enterprise-grade multi-tenancy features, making your app ready for commercial deployment and scaling.