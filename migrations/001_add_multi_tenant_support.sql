-- Multi-Tenant Migration Script
-- This script adds multi-tenancy support to the existing electricity tracker

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    subscription_status TEXT DEFAULT 'active',
    max_users INTEGER DEFAULT 5
);

-- Create tenant_users junction table
CREATE TABLE IF NOT EXISTS tenant_users (
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

-- Add tenant_id to existing tables
-- Note: Use IF NOT EXISTS equivalent for SQLite
-- Check if column exists first to avoid errors on re-run

-- Add tenant_id to vouchers table
ALTER TABLE vouchers ADD COLUMN tenant_id INTEGER;

-- Add tenant_id to readings table
ALTER TABLE readings ADD COLUMN tenant_id INTEGER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_id ON vouchers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_readings_tenant_id ON readings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_date ON vouchers(tenant_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_readings_tenant_date ON readings(tenant_id, reading_date DESC);