const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Determine database path - check if we're in Cloudflare Workers environment
let dbPath;
if (process.env.NODE_ENV === 'production' && process.env.CF_PAGES) {
    // Cloudflare environment - use D1 database
    console.log('Running in Cloudflare environment - manual D1 migration required');
    process.exit(1);
} else {
    // Local environment
    dbPath = path.join(__dirname, '..', 'database.db');
}

console.log('Multi-Tenant Migration Starting...');
console.log('Database path:', dbPath);

// Backup database first
const backupPath = `${dbPath}.backup.${Date.now()}`;
if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Database backed up to: ${backupPath}`);
}

const db = new Database(dbPath);

try {
    // Begin transaction
    db.exec('BEGIN TRANSACTION');

    console.log('📋 Creating multi-tenant tables...');

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

    console.log('✅ Multi-tenant tables created');

    // Check if tenant_id columns already exist
    const vouchersInfo = db.pragma('table_info(vouchers)');
    const readingsInfo = db.pragma('table_info(readings)');

    const vouchersHasTenantId = vouchersInfo.some(col => col.name === 'tenant_id');
    const readingsHasTenantId = readingsInfo.some(col => col.name === 'tenant_id');

    // Add tenant_id columns if they don't exist
    if (!vouchersHasTenantId) {
        db.exec('ALTER TABLE vouchers ADD COLUMN tenant_id INTEGER');
        console.log('✅ Added tenant_id to vouchers table');
    } else {
        console.log('ℹ️  tenant_id already exists in vouchers table');
    }

    if (!readingsHasTenantId) {
        db.exec('ALTER TABLE readings ADD COLUMN tenant_id INTEGER');
        console.log('✅ Added tenant_id to readings table');
    } else {
        console.log('ℹ️  tenant_id already exists in readings table');
    }

    // Create indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_id ON vouchers(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_readings_tenant_id ON readings(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
        CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_date ON vouchers(tenant_id, purchase_date DESC);
        CREATE INDEX IF NOT EXISTS idx_readings_tenant_date ON readings(tenant_id, reading_date DESC);
    `);

    console.log('✅ Indexes created');

    // Migrate existing users to tenants
    console.log('👥 Migrating existing users to tenant structure...');

    const users = db.prepare('SELECT * FROM users').all();
    console.log(`Found ${users.length} existing users`);

    for (const user of users) {
        // Create tenant for each user
        const tenantResult = db.prepare(`
            INSERT INTO tenants (name)
            VALUES (?)
        `).run(`${user.email}'s Family`);

        const tenantId = tenantResult.lastInsertRowid;

        // Link user to tenant as admin
        db.prepare(`
            INSERT OR IGNORE INTO tenant_users (tenant_id, user_id, role)
            VALUES (?, ?, 'admin')
        `).run(tenantId, user.id);

        // Update user's vouchers with tenant_id
        const voucherUpdateResult = db.prepare(`
            UPDATE vouchers SET tenant_id = ? WHERE user_id = ? AND tenant_id IS NULL
        `).run(tenantId, user.id);

        // Update user's readings with tenant_id
        const readingUpdateResult = db.prepare(`
            UPDATE readings SET tenant_id = ? WHERE user_id = ? AND tenant_id IS NULL
        `).run(tenantId, user.id);

        console.log(`✅ Migrated user ${user.email}:`);
        console.log(`   - Tenant ID: ${tenantId}`);
        console.log(`   - Vouchers updated: ${voucherUpdateResult.changes}`);
        console.log(`   - Readings updated: ${readingUpdateResult.changes}`);
    }

    // Commit transaction
    db.exec('COMMIT');

    console.log('🎉 Multi-tenant migration completed successfully!');
    console.log(`📊 Migration Summary:`);
    console.log(`   - Users migrated: ${users.length}`);
    console.log(`   - Tenants created: ${users.length}`);
    console.log(`   - Backup created: ${backupPath}`);
    console.log(`   - Database: ${dbPath}`);

    // Verify migration
    const tenantCount = db.prepare('SELECT COUNT(*) as count FROM tenants').get().count;
    const tenantUserCount = db.prepare('SELECT COUNT(*) as count FROM tenant_users').get().count;

    console.log(`📋 Verification:`);
    console.log(`   - Total tenants: ${tenantCount}`);
    console.log(`   - Total tenant-user relationships: ${tenantUserCount}`);

} catch (error) {
    console.error('❌ Migration failed:', error);
    db.exec('ROLLBACK');

    console.log('🔄 Rolling back changes...');
    if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, dbPath);
        console.log('✅ Database restored from backup');
    }

    process.exit(1);
} finally {
    db.close();
}