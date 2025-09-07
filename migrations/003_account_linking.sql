-- Account groups for sharing electricity data between linked accounts
CREATE TABLE IF NOT EXISTS account_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by_user_id INTEGER NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Link users to account groups
CREATE TABLE IF NOT EXISTS user_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member' CHECK(role IN ('owner', 'member')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES account_groups (id) ON DELETE CASCADE,
    UNIQUE(user_id, group_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_account_groups_invite_code ON account_groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);

-- Create a view for easy data access across linked accounts
CREATE VIEW IF NOT EXISTS shared_user_data AS
SELECT 
    u.id as user_id,
    u.email,
    ug.group_id,
    ag.name as group_name,
    ug.role,
    -- Get all user IDs in the same group for data sharing
    GROUP_CONCAT(ug2.user_id) as shared_user_ids
FROM users u
LEFT JOIN user_groups ug ON u.id = ug.user_id
LEFT JOIN account_groups ag ON ug.group_id = ag.id
LEFT JOIN user_groups ug2 ON ag.id = ug2.group_id
GROUP BY u.id, u.email, ug.group_id, ag.name, ug.role;