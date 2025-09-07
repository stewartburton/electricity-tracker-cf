-- Add notes columns if they don't exist (for existing databases)
-- These will fail silently if the columns already exist
-- Run these as separate migration if your database doesn't have notes columns:
ALTER TABLE vouchers ADD COLUMN notes TEXT;
ALTER TABLE readings ADD COLUMN notes TEXT;