-- Email Invitation System Migration
-- Run with: npx wrangler d1 execute electricity-tracker-db --file=migrations/003_email_invitations.sql --remote

-- Create email_invitations table for tracking email invitations
CREATE TABLE IF NOT EXISTS email_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    sent_by_user_id INTEGER NOT NULL,
    invitation_type TEXT NOT NULL CHECK (invitation_type IN ('family', 'new_account')),
    recipient_email TEXT NOT NULL,
    invite_code TEXT, -- Links to invite_codes table for family invitations
    referral_code TEXT, -- Unique code for new account invitations
    email_subject TEXT NOT NULL,
    email_body_html TEXT NOT NULL,
    email_body_text TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'registered')),
    opened_at DATETIME,
    clicked_at DATETIME,
    registered_at DATETIME,
    registered_user_id INTEGER,
    expires_at DATETIME,
    metadata TEXT, -- JSON string for tracking data, email provider response, etc.
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (sent_by_user_id) REFERENCES users(id),
    FOREIGN KEY (registered_user_id) REFERENCES users(id)
);

-- Add email tracking to existing invite_codes table
ALTER TABLE invite_codes ADD COLUMN email_invitation_id INTEGER;
ALTER TABLE invite_codes ADD COLUMN sent_via_email BOOLEAN DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_invitations_tenant_id ON email_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_invitations_recipient_email ON email_invitations(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_invitations_referral_code ON email_invitations(referral_code);
CREATE INDEX IF NOT EXISTS idx_email_invitations_status ON email_invitations(status);
CREATE INDEX IF NOT EXISTS idx_email_invitations_sent_by ON email_invitations(sent_by_user_id);
CREATE INDEX IF NOT EXISTS idx_email_invitations_type ON email_invitations(invitation_type);

-- Index for invite_codes email tracking
CREATE INDEX IF NOT EXISTS idx_invite_codes_email_invitation ON invite_codes(email_invitation_id);