-- Multi-Tenant Migration for D1 Database
-- Run with: npx wrangler d1 execute electricity-tracker-db --file=migrations/001_multi_tenant.sql

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
    role TEXT DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(tenant_id, user_id)
);

-- Add tenant_id to existing tables
ALTER TABLE vouchers ADD COLUMN tenant_id INTEGER;
ALTER TABLE readings ADD COLUMN tenant_id INTEGER;

-- Create indexes for performance
CREATE INDEX idx_vouchers_tenant_id ON vouchers(tenant_id);
CREATE INDEX idx_readings_tenant_id ON readings(tenant_id);
CREATE INDEX idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user_id ON tenant_users(user_id);

-- Create a default tenant for existing data
INSERT INTO tenants (name) VALUES ('Default Family');

-- Link existing users to default tenant
INSERT INTO tenant_users (tenant_id, user_id, role)
SELECT 1, id, 'admin' FROM users;

-- Update existing vouchers and readings
UPDATE vouchers SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE readings SET tenant_id = 1 WHERE tenant_id IS NULL;