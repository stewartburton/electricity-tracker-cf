import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import { cors } from 'hono/cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import CloudflareEmailService from './services/cloudflareEmailService.js';

// Helper function to extract a friendly name from email address
function getFriendlyNameFromEmail(email) {
  if (!email) return 'User';

  // Extract the part before @ and remove numbers
  const localPart = email.split('@')[0];

  // Handle formats like "stewart.burton84" or "john.doe"
  const nameWithoutNumbers = localPart.replace(/\d+/g, '');

  // Split by dots, underscores, or hyphens
  const nameParts = nameWithoutNumbers.split(/[._-]/);

  // Capitalize each part
  const capitalizedParts = nameParts
    .filter(part => part.length > 0)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

  return capitalizedParts.join(' ') || 'User';
}

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// JWT Secret from environment variables

// Auth middleware
const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, c.env.JWT_SECRET);
    c.set('user', decoded);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

// Tenant middleware for multi-tenant data isolation
const tenantMiddleware = async (c, next) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const db = c.env.DB;

    // Get user's tenant
    const tenantUser = await db.prepare(`
      SELECT t.*, tu.role
      FROM tenants t
      JOIN tenant_users tu ON t.id = tu.tenant_id
      WHERE tu.user_id = ?
    `).bind(user.userId).first();

    if (!tenantUser) {
      return c.json({ error: 'No tenant access' }, 403);
    }

    c.set('tenant', {
      id: tenantUser.id,
      name: tenantUser.name,
      role: tenantUser.role,
      subscription_status: tenantUser.subscription_status
    });

    await next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login endpoint
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Query the database for user
    const db = c.env.DB;
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email
      },
      c.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user data and token
    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Register endpoint
app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, registrationKey, inviteCode } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Must have either registration key OR invite code
    if (!registrationKey && !inviteCode) {
      return c.json({ error: 'Either registration key or invite code is required' }, 400);
    }

    const db = c.env.DB;
    
    // Check if user already exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    
    if (existingUser) {
      return c.json({ error: 'User already exists' }, 409);
    }

    // If using invite code, validate it exists
    let groupId = null;
    if (inviteCode) {
      const group = await db.prepare(`
        SELECT id FROM account_groups WHERE invite_code = ?
      `).bind(inviteCode).first();
      
      if (!group) {
        return c.json({ error: 'Invalid invite code' }, 400);
      }
      groupId = group.id;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user
    const result = await db.prepare(`
      INSERT INTO users (email, password, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).bind(email, hashedPassword).run();

    if (!result.success) {
      return c.json({ error: 'Failed to create user' }, 500);
    }

    const userId = result.meta.last_row_id;

    if (inviteCode) {
      // Join existing tenant via invite code
      const invite = await db.prepare(`
        SELECT * FROM invite_codes
        WHERE code = ? AND is_active = 1
        AND expires_at > datetime('now')
        AND current_uses < max_uses
      `).bind(inviteCode).first();

      if (invite) {
        // Add user to existing tenant
        await db.prepare(`
          INSERT INTO tenant_users (tenant_id, user_id, role)
          VALUES (?, ?, 'member')
        `).bind(invite.tenant_id, userId).run();

        // Update invite usage
        await db.prepare(`
          UPDATE invite_codes
          SET current_uses = current_uses + 1
          WHERE id = ?
        `).run(invite.id);
      } else {
        // Invalid invite code - create own tenant
        const tenantResult = await db.prepare(`
          INSERT INTO tenants (name)
          VALUES (?)
        `).bind(`${email}'s Family`).run();

        await db.prepare(`
          INSERT INTO tenant_users (tenant_id, user_id, role)
          VALUES (?, ?, 'admin')
        `).bind(tenantResult.meta.last_row_id, userId).run();
      }
    } else {
      // No invite code - create new tenant for user
      const tenantResult = await db.prepare(`
        INSERT INTO tenants (name)
        VALUES (?)
      `).bind(`${email}'s Family`).run();

      await db.prepare(`
        INSERT INTO tenant_users (tenant_id, user_id, role)
        VALUES (?, ?, 'admin')
      `).bind(tenantResult.meta.last_row_id, userId).run();
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: userId, 
        email: email
      },
      c.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return c.json({
      success: true,
      token,
      user: {
        id: userId,
        email: email,
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Helper function to get shared user IDs for account linking
async function getSharedUserIds(db, userId) {
  const result = await db.prepare(`
    SELECT ug2.user_id
    FROM user_groups ug1
    JOIN user_groups ug2 ON ug1.group_id = ug2.group_id
    WHERE ug1.user_id = ?
  `).bind(userId).all();
  
  if (result.results && result.results.length > 0) {
    return result.results.map(row => row.user_id);
  }
  
  return [userId]; // If no linked accounts, return just the current user
}

// Protected routes
app.use('/api/readings/*', authMiddleware, tenantMiddleware);
app.use('/api/vouchers/*', authMiddleware, tenantMiddleware);
app.use('/api/dashboard/*', authMiddleware, tenantMiddleware);
app.use('/api/transactions', authMiddleware, tenantMiddleware);
app.use('/api/tenants/*', authMiddleware, tenantMiddleware);
app.use('/api/export/*', authMiddleware, tenantMiddleware);
app.use('/api/account/*', authMiddleware);

// Create reading endpoint
app.post('/api/readings', async (c) => {
  try {
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;
    const { reading_value, reading_date, notes } = await c.req.json();

    // Validate required fields
    if (!reading_value || !reading_date) {
      return c.json({ error: 'Reading value and date are required' }, 400);
    }

    // Insert new reading with tenant isolation
    const result = await db.prepare(`
      INSERT INTO readings (user_id, tenant_id, reading_value, reading_date, notes, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(user.userId, tenant.id, reading_value, reading_date, notes || null).run();

    if (result.success) {
      return c.json({
        success: true,
        message: 'Reading saved successfully',
        id: result.meta.last_row_id
      });
    } else {
      throw new Error('Failed to insert reading');
    }
  } catch (error) {
    console.error('Reading creation error:', error);
    return c.json({ error: error.message || 'Failed to save reading' }, 500);
  }
});

// Delete reading endpoint
app.delete('/api/readings/:id', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;
    const { id } = c.req.param();

    if (!id) {
      return c.json({ error: 'Reading ID is required' }, 400);
    }

    // First check if reading exists and belongs to user
    const reading = await db.prepare(`
      SELECT * FROM readings WHERE id = ? AND user_id = ?
    `).bind(id, user.userId).first();

    if (!reading) {
      return c.json({
        success: false,
        error: 'Reading not found or access denied'
      }, 404);
    }

    // Delete the reading
    const result = await db.prepare(`
      DELETE FROM readings WHERE id = ? AND user_id = ?
    `).bind(id, user.userId).run();

    if (result.success) {
      return c.json({
        success: true,
        message: 'Reading deleted successfully',
        deletedId: parseInt(id)
      });
    } else {
      throw new Error('Failed to delete reading');
    }
  } catch (error) {
    console.error('Error deleting reading:', error);
    return c.json({
      success: false,
      error: 'Failed to delete reading'
    }, 500);
  }
});

// Create voucher endpoint
app.post('/api/vouchers', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;
    const { token_number, purchase_date, rand_amount, kwh_amount, vat_amount, notes } = await c.req.json();

    // Validate required fields
    if (!token_number || !purchase_date || !rand_amount || !kwh_amount) {
      return c.json({ error: 'Token number, purchase date, rand amount, and kWh amount are required' }, 400);
    }

    // Insert new voucher
    const result = await db.prepare(`
      INSERT INTO vouchers (user_id, token_number, purchase_date, rand_amount, kwh_amount, vat_amount, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(user.userId, token_number, purchase_date, rand_amount, kwh_amount, vat_amount || 0, notes || null).run();

    if (result.success) {
      return c.json({
        success: true,
        message: 'Voucher saved successfully',
        id: result.meta.last_row_id
      });
    } else {
      throw new Error('Failed to insert voucher');
    }
  } catch (error) {
    console.error('Voucher creation error:', error);
    return c.json({ error: error.message || 'Failed to save voucher' }, 500);
  }
});

// Delete voucher endpoint
app.delete('/api/vouchers/:id', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;
    const { id } = c.req.param();

    if (!id) {
      return c.json({ error: 'Voucher ID is required' }, 400);
    }

    // First check if voucher exists and belongs to user
    const voucher = await db.prepare(`
      SELECT * FROM vouchers WHERE id = ? AND user_id = ?
    `).bind(id, user.userId).first();

    if (!voucher) {
      return c.json({
        success: false,
        error: 'Voucher not found or access denied'
      }, 404);
    }

    // Delete the voucher
    const result = await db.prepare(`
      DELETE FROM vouchers WHERE id = ? AND user_id = ?
    `).bind(id, user.userId).run();

    if (result.success) {
      return c.json({
        success: true,
        message: 'Voucher deleted successfully',
        deletedId: parseInt(id)
      });
    } else {
      throw new Error('Failed to delete voucher');
    }
  } catch (error) {
    console.error('Error deleting voucher:', error);
    return c.json({
      success: false,
      error: 'Failed to delete voucher'
    }, 500);
  }
});

// Dashboard endpoint (legacy compatibility)
app.get('/api/dashboard', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;
    
    // Get all shared user IDs (including linked accounts)
    const sharedUserIds = await getSharedUserIds(db, user.userId);
    const userIdsStr = sharedUserIds.join(',');

    // Get voucher totals
    const voucherResult = await db.prepare(`
      SELECT 
        COALESCE(SUM(rand_amount), 0) as total_amount,
        COALESCE(SUM(kwh_amount), 0) as total_units,
        COALESCE(SUM(vat_amount), 0) as total_vat,
        COUNT(*) as total_vouchers
      FROM vouchers 
      WHERE user_id IN (${userIdsStr})
    `).first();

    // Calculate average cost per kWh
    const avgCostPerKwh = voucherResult.total_units > 0 ? 
      voucherResult.total_amount / voucherResult.total_units : 0;

    // Get recent vouchers
    const recentVouchers = await db.prepare(`
      SELECT * FROM vouchers 
      WHERE user_id IN (${userIdsStr})
      ORDER BY purchase_date DESC 
      LIMIT 5
    `).all();

    // Get recent readings
    const recentReadings = await db.prepare(`
      SELECT * FROM readings 
      WHERE user_id IN (${userIdsStr})
      ORDER BY reading_date DESC 
      LIMIT 5
    `).all();

    // Get monthly data for the last 6 months
    const monthlyData = await db.prepare(`
      SELECT 
        strftime('%Y-%m', purchase_date) as month,
        SUM(rand_amount) as amount,
        SUM(kwh_amount) as kwh
      FROM vouchers 
      WHERE user_id IN (${userIdsStr})
        AND purchase_date >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', purchase_date)
      ORDER BY month DESC
    `).all();

    return c.json({
      success: true,
      totalVouchers: voucherResult.total_vouchers || 0,
      totalAmount: voucherResult.total_amount || 0,
      totalUnits: voucherResult.total_units || 0,
      totalVat: voucherResult.total_vat || 0,
      avgCostPerKwh: avgCostPerKwh || 0,
      recentVouchers: recentVouchers.results || [],
      recentReadings: recentReadings.results || [],
      monthlyData: monthlyData.results || [],
      linkedAccountCount: sharedUserIds.length
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json({ error: 'Failed to fetch dashboard data' }, 500);
  }
});

// Dashboard stats (new format)
app.get('/api/dashboard/stats', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;
    
    // Get all shared user IDs (including linked accounts)
    const sharedUserIds = await getSharedUserIds(db, user.userId);
    const userIdsStr = sharedUserIds.join(',');

    // Get voucher totals (money spent)
    const voucherResult = await db.prepare(`
      SELECT 
        COALESCE(SUM(rand_amount), 0) as total_purchased,
        COALESCE(SUM(kwh_amount), 0) as total_kwh_purchased,
        COUNT(*) as voucher_count
      FROM vouchers 
      WHERE user_id IN (${userIdsStr})
    `).first();

    // Get reading data
    const readingResult = await db.prepare(`
      SELECT 
        COUNT(*) as reading_count,
        MIN(reading_value) as lowest_reading,
        MAX(reading_value) as highest_reading,
        AVG(reading_value) as avg_reading
      FROM readings 
      WHERE user_id IN (${userIdsStr})
    `).first();

    // Get recent vouchers and readings combined
    const recentVouchers = await db.prepare(`
      SELECT 
        'voucher' as type,
        rand_amount as amount,
        kwh_amount,
        token_number,
        purchase_date as date,
        created_at,
        notes
      FROM vouchers 
      WHERE user_id IN (${userIdsStr})
      ORDER BY purchase_date DESC 
      LIMIT 3
    `).all();

    const recentReadings = await db.prepare(`
      SELECT 
        'reading' as type,
        reading_value as amount,
        reading_date as date,
        created_at,
        notes
      FROM readings 
      WHERE user_id IN (${userIdsStr})
      ORDER BY reading_date DESC 
      LIMIT 3
    `).all();

    return c.json({
      success: true,
      data: {
        totalPurchased: voucherResult.total_purchased || 0,
        totalKwhPurchased: voucherResult.total_kwh_purchased || 0,
        voucherCount: voucherResult.voucher_count || 0,
        readingCount: readingResult.reading_count || 0,
        lowestReading: readingResult.lowest_reading || 0,
        highestReading: readingResult.highest_reading || 0,
        avgReading: readingResult.avg_reading || 0,
        recentVouchers: recentVouchers.results || [],
        recentReadings: recentReadings.results || [],
        linkedAccountCount: sharedUserIds.length
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return c.json({ error: 'Failed to fetch dashboard data' }, 500);
  }
});

// Account management endpoints
app.get('/api/account/info', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;

    // Get account info with group details
    const accountInfo = await db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.created_at,
        ag.id as group_id,
        ag.name as group_name,
        ag.invite_code,
        ug.role,
        ug.joined_at
      FROM users u
      LEFT JOIN user_groups ug ON u.id = ug.user_id
      LEFT JOIN account_groups ag ON ug.group_id = ag.id
      WHERE u.id = ?
    `).bind(user.userId).first();

    // Get linked accounts if in a group
    let linkedAccounts = [];
    if (accountInfo.group_id) {
      const linkedResult = await db.prepare(`
        SELECT 
          u.id,
          u.email,
          ug.role,
          ug.joined_at
        FROM user_groups ug
        JOIN users u ON ug.user_id = u.id
        WHERE ug.group_id = ? AND u.id != ?
        ORDER BY ug.joined_at ASC
      `).bind(accountInfo.group_id, user.userId).all();
      
      linkedAccounts = linkedResult.results || [];
    }

    return c.json({
      success: true,
      data: {
        user: {
          id: accountInfo.id,
          email: accountInfo.email,
          created_at: accountInfo.created_at
        },
        group: accountInfo.group_id ? {
          id: accountInfo.group_id,
          name: accountInfo.group_name,
          invite_code: accountInfo.invite_code,
          role: accountInfo.role,
          joined_at: accountInfo.joined_at
        } : null,
        linkedAccounts
      }
    });

  } catch (error) {
    console.error('Account info error:', error);
    return c.json({ error: 'Failed to fetch account info' }, 500);
  }
});

app.post('/api/account/create-group', async (c) => {
  try {
    const user = c.get('user');
    const { name } = await c.req.json();
    const db = c.env.DB;

    if (!name || name.trim().length < 3) {
      return c.json({ error: 'Group name must be at least 3 characters' }, 400);
    }

    // Check if user is already in a group
    const existingGroup = await db.prepare(`
      SELECT group_id FROM user_groups WHERE user_id = ?
    `).bind(user.userId).first();

    if (existingGroup) {
      return c.json({ error: 'You are already in an account group' }, 400);
    }

    // Generate unique invite code
    const inviteCode = `${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${new Date().getFullYear()}`;

    // Create group
    const groupResult = await db.prepare(`
      INSERT INTO account_groups (name, created_by_user_id, invite_code)
      VALUES (?, ?, ?)
    `).bind(name.trim(), user.userId, inviteCode).run();

    if (!groupResult.success) {
      return c.json({ error: 'Failed to create group' }, 500);
    }

    // Add user as owner
    await db.prepare(`
      INSERT INTO user_groups (user_id, group_id, role)
      VALUES (?, ?, 'owner')
    `).bind(user.userId, groupResult.meta.last_row_id).run();

    return c.json({
      success: true,
      data: {
        group_id: groupResult.meta.last_row_id,
        name: name.trim(),
        invite_code: inviteCode,
        role: 'owner'
      }
    });

  } catch (error) {
    console.error('Create group error:', error);
    return c.json({ error: 'Failed to create group' }, 500);
  }
});

app.post('/api/account/join-group', async (c) => {
  try {
    const user = c.get('user');
    const { inviteCode } = await c.req.json();
    const db = c.env.DB;

    if (!inviteCode || inviteCode.trim().length < 5) {
      return c.json({ error: 'Invalid invite code' }, 400);
    }

    // Check if user is already in a group
    const existingGroup = await db.prepare(`
      SELECT group_id FROM user_groups WHERE user_id = ?
    `).bind(user.userId).first();

    if (existingGroup) {
      return c.json({ error: 'You are already in an account group' }, 400);
    }

    // Find group by invite code
    const group = await db.prepare(`
      SELECT id, name FROM account_groups WHERE invite_code = ?
    `).bind(inviteCode.trim()).first();

    if (!group) {
      return c.json({ error: 'Invalid invite code' }, 400);
    }

    // Add user to group
    const result = await db.prepare(`
      INSERT INTO user_groups (user_id, group_id, role)
      VALUES (?, ?, 'member')
    `).bind(user.userId, group.id).run();

    if (!result.success) {
      return c.json({ error: 'Failed to join group' }, 500);
    }

    return c.json({
      success: true,
      data: {
        group_id: group.id,
        name: group.name,
        role: 'member'
      }
    });

  } catch (error) {
    console.error('Join group error:', error);
    return c.json({ error: 'Failed to join group' }, 500);
  }
});

app.post('/api/account/leave-group', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;

    // Get user's group info
    const userGroup = await db.prepare(`
      SELECT ug.group_id, ug.role, ag.created_by_user_id
      FROM user_groups ug
      JOIN account_groups ag ON ug.group_id = ag.id
      WHERE ug.user_id = ?
    `).bind(user.userId).first();

    if (!userGroup) {
      return c.json({ error: 'You are not in any group' }, 400);
    }

    // If owner is leaving, transfer ownership or delete group
    if (userGroup.role === 'owner') {
      const memberCount = await db.prepare(`
        SELECT COUNT(*) as count FROM user_groups WHERE group_id = ? AND user_id != ?
      `).bind(userGroup.group_id, user.userId).first();

      if (memberCount.count > 0) {
        // Transfer ownership to oldest member
        await db.prepare(`
          UPDATE user_groups 
          SET role = 'owner' 
          WHERE group_id = ? AND user_id != ? 
          ORDER BY joined_at ASC 
          LIMIT 1
        `).bind(userGroup.group_id, user.userId).run();
      } else {
        // Delete empty group
        await db.prepare(`
          DELETE FROM account_groups WHERE id = ?
        `).bind(userGroup.group_id).run();
      }
    }

    // Remove user from group
    await db.prepare(`
      DELETE FROM user_groups WHERE user_id = ?
    `).bind(user.userId).run();

    return c.json({ success: true });

  } catch (error) {
    console.error('Leave group error:', error);
    return c.json({ error: 'Failed to leave group' }, 500);
  }
});

// Transactions endpoint for history page
app.get('/api/transactions', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;
    
    // Get all shared user IDs (including linked accounts) - same as dashboard
    const sharedUserIds = await getSharedUserIds(db, user.userId);
    const userIdsStr = sharedUserIds.join(',');
    
    // Get month filter if provided
    const month = c.req.query('month');
    let dateFilter = '';
    let readingDateFilter = '';
    
    if (month) {
      dateFilter = `AND strftime('%Y-%m', purchase_date) = '${month}'`;
      readingDateFilter = `AND strftime('%Y-%m', reading_date) = '${month}'`;
      console.log(`Filtering by month: ${month}, dateFilter: ${dateFilter}, readingDateFilter: ${readingDateFilter}`);
    }
    
    // Get vouchers - use actual purchase_date for timestamp
    const vouchers = await db.prepare(`
      SELECT 
        'voucher' as type,
        id,
        user_id,
        token_number,
        purchase_date,
        purchase_date as date,
        rand_amount,
        kwh_amount,
        vat_amount,
        notes
      FROM vouchers 
      WHERE user_id IN (${userIdsStr}) ${dateFilter}
      ORDER BY purchase_date DESC
    `).all();

    // Get readings - use actual reading_date for timestamp
    const readings = await db.prepare(`
      SELECT 
        'reading' as type,
        id,
        user_id,
        reading_value,
        reading_date,
        reading_date as date,
        notes
      FROM readings 
      WHERE user_id IN (${userIdsStr}) ${readingDateFilter}
      ORDER BY reading_date DESC
    `).all();
    

    return c.json({
      success: true,
      vouchers: vouchers.results || [],
      readings: readings.results || [],
      totalVouchers: (vouchers.results || []).length,
      totalReadings: (readings.results || []).length
    });

  } catch (error) {
    console.error('Transactions error:', error.message);
    return c.json({ 
      error: 'Failed to fetch transaction data',
      details: error.message 
    }, 500);
  }
});

app.post('/api/account/change-password', async (c) => {
  try {
    const user = c.get('user');
    const { currentPassword, newPassword } = await c.req.json();
    const db = c.env.DB;

    if (!currentPassword || !newPassword) {
      return c.json({ error: 'Current password and new password are required' }, 400);
    }

    if (newPassword.length < 6) {
      return c.json({ error: 'New password must be at least 6 characters' }, 400);
    }

    // Get current user data
    const userData = await db.prepare(`
      SELECT password FROM users WHERE id = ?
    `).bind(user.userId).first();

    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userData.password);
    
    if (!isValidPassword) {
      return c.json({ error: 'Current password is incorrect' }, 401);
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password
    const result = await db.prepare(`
      UPDATE users SET password = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(hashedNewPassword, user.userId).run();

    if (!result.success) {
      return c.json({ error: 'Failed to update password' }, 500);
    }

    return c.json({ 
      success: true,
      message: 'Password updated successfully' 
    });

  } catch (error) {
    console.error('Change password error:', error);
    return c.json({ error: 'Failed to change password' }, 500);
  }
});

// Tenant Management Endpoints

// Create invite code
app.post('/api/tenants/invite', async (c) => {
  try {
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;

    if (tenant.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    // Generate unique invite code
    const code = Math.random().toString(36).substr(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await db.prepare(`
      INSERT INTO invite_codes (tenant_id, code, created_by, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(tenant.id, code, user.userId, expiresAt.toISOString()).run();

    return c.json({
      success: true,
      code,
      expires_at: expiresAt,
      id: result.meta.last_row_id
    });
  } catch (error) {
    console.error('Create invite error:', error);
    return c.json({ error: 'Failed to create invite code' }, 500);
  }
});

// Join tenant via invite code (for existing users)
app.post('/api/tenants/join', async (c) => {
  try {
    const user = c.get('user');
    const { code } = await c.req.json();
    const db = c.env.DB;

    // Validate invite code
    const invite = await db.prepare(`
      SELECT * FROM invite_codes
      WHERE code = ? AND is_active = 1
      AND expires_at > datetime('now')
      AND current_uses < max_uses
    `).bind(code).first();

    if (!invite) {
      return c.json({ error: 'Invalid or expired invite code' }, 400);
    }

    // Check if user already in this tenant
    const existing = await db.prepare(`
      SELECT id FROM tenant_users
      WHERE tenant_id = ? AND user_id = ?
    `).bind(invite.tenant_id, user.userId).first();

    if (existing) {
      return c.json({ error: 'Already member of this tenant' }, 400);
    }

    // Add user to tenant
    await db.prepare(`
      INSERT INTO tenant_users (tenant_id, user_id, role)
      VALUES (?, ?, 'member')
    `).bind(invite.tenant_id, user.userId).run();

    // Update invite usage
    await db.prepare(`
      UPDATE invite_codes
      SET current_uses = current_uses + 1
      WHERE id = ?
    `).bind(invite.id).run();

    return c.json({ success: true, message: 'Successfully joined tenant' });
  } catch (error) {
    console.error('Join tenant error:', error);
    return c.json({ error: 'Failed to join tenant' }, 500);
  }
});

// Export tenant data
app.get('/api/export/data', async (c) => {
  try {
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;

    // Get all tenant data
    const vouchers = await db.prepare(`
      SELECT * FROM vouchers WHERE tenant_id = ?
    `).bind(tenant.id).all();

    const readings = await db.prepare(`
      SELECT * FROM readings WHERE tenant_id = ?
    `).bind(tenant.id).all();

    const tenantInfo = await db.prepare(`
      SELECT t.*, GROUP_CONCAT(u.email) as members
      FROM tenants t
      JOIN tenant_users tu ON t.id = tu.tenant_id
      JOIN users u ON tu.user_id = u.id
      WHERE t.id = ?
      GROUP BY t.id
    `).bind(tenant.id).first();

    const exportData = {
      export_date: new Date().toISOString(),
      tenant: tenantInfo,
      vouchers: vouchers.results || [],
      readings: readings.results || [],
      summary: {
        total_vouchers: (vouchers.results || []).length,
        total_readings: (readings.results || []).length,
        total_amount_spent: (vouchers.results || []).reduce((sum, v) => sum + (v.rand_amount || 0), 0)
      }
    };

    // Set headers for download
    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', `attachment; filename="electricity-data-${tenant.id}-${Date.now()}.json"`);

    return c.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    return c.json({ error: 'Failed to export data' }, 500);
  }
});

// Email Invitation Endpoints

// Send family invitation via email
app.post('/api/invitations/family', authMiddleware, tenantMiddleware, async (c) => {
  try {
    console.log('=== Family Invitation Debug Start ===');

    // Parse request data
    let requestData;
    try {
      requestData = await c.req.json();
      console.log('Request data parsed:', requestData);
    } catch (error) {
      console.error('Failed to parse request JSON:', error);
      return c.json({ error: 'Invalid JSON in request body' }, 400);
    }

    const { email, recipientEmail, personalMessage } = requestData;
    const emailToUse = email || recipientEmail;
    console.log('Email to use:', emailToUse);

    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;

    console.log('User:', user?.userId, user?.email);
    console.log('Tenant:', tenant?.id, tenant?.name, tenant?.role);
    console.log('DB available:', !!db);

    // Validate admin role
    if (tenant.role !== 'admin') {
      return c.json({ error: 'Admin role required to send family invitations' }, 403);
    }

    // Validate email
    if (!emailToUse || !emailToUse.includes('@')) {
      return c.json({ error: 'Valid email address is required' }, 400);
    }

    // Check if user already exists and is in the tenant
    const existingUser = await db.prepare(`
      SELECT u.id, tu.tenant_id
      FROM users u
      LEFT JOIN tenant_users tu ON u.id = tu.user_id AND tu.tenant_id = ?
      WHERE u.email = ?
    `).bind(tenant.id, emailToUse).first();

    if (existingUser && existingUser.tenant_id) {
      return c.json({ error: 'User is already a member of this family account' }, 400);
    }

    // Generate invite code
    const inviteCode = crypto.randomUUID().substring(0, 8).toUpperCase();

    // Create invite code record
    const inviteResult = await db.prepare(`
      INSERT INTO invite_codes (tenant_id, code, created_by, expires_at, max_uses, current_uses, is_active)
      VALUES (?, ?, ?, ?, 1, 0, 1)
    `).bind(
      tenant.id,
      inviteCode,
      user.userId,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    ).run();

    if (!inviteResult.success) {
      return c.json({ error: 'Failed to create invitation' }, 500);
    }

    // Create email invitation record (temporary - will be updated after email sending)
    const emailInvitationResult = await db.prepare(`
      INSERT INTO email_invitations (
        tenant_id, sent_by_user_id, invitation_type, recipient_email,
        invite_code, email_subject, email_body_html, email_body_text,
        expires_at
      ) VALUES (?, ?, 'family', ?, ?, 'temp', 'temp', 'temp', ?)
    `).bind(
      tenant.id,
      user.userId,
      emailToUse,
      inviteCode,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    ).run();

    const emailInvitationId = emailInvitationResult.meta.last_row_id;

    // Send email
    console.log('Creating email service...');
    console.log('Environment vars available:', {
      RESEND_API_KEY: !!c.env.RESEND_API_KEY,
      FROM_EMAIL: c.env.FROM_EMAIL,
      BASE_URL: c.env.BASE_URL
    });

    const emailService = new CloudflareEmailService(c.env);
    console.log('Email service created successfully');

    const invitationData = {
      recipientEmail: emailToUse,
      senderName: user.name || getFriendlyNameFromEmail(user.email),
      senderEmail: user.email,
      inviteCode,
      tenantName: tenant.name,
      personalMessage,
      emailInvitationId
    };
    console.log('Sending email with data:', invitationData);

    let emailResult;
    try {
      emailResult = await emailService.sendFamilyInvitation(invitationData);
      console.log('Email send result:', emailResult);
    } catch (emailError) {
      console.error('Email service error:', emailError);
      return c.json({ error: 'Failed to send invitation email: ' + emailError.message }, 500);
    }

    if (!emailResult.success) {
      console.error('Email sending failed:', emailResult.error);
      return c.json({ error: 'Failed to send invitation email: ' + emailResult.error }, 500);
    }

    // Update email invitation record with actual content
    await db.prepare(`
      UPDATE email_invitations
      SET email_subject = ?, email_body_html = ?, email_body_text = ?,
          metadata = ?
      WHERE id = ?
    `).bind(
      emailResult.subject,
      emailResult.htmlBody,
      emailResult.textBody,
      JSON.stringify({ messageId: emailResult.messageId, threadId: emailResult.threadId }),
      emailInvitationId
    ).run();

    // Update invite_codes with email reference
    await db.prepare(`
      UPDATE invite_codes
      SET email_invitation_id = ?, sent_via_email = 1
      WHERE code = ?
    `).bind(emailInvitationId, inviteCode).run();

    return c.json({
      success: true,
      message: 'Family invitation sent successfully',
      inviteCode,
      recipientEmail: email,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      emailInvitationId
    });

  } catch (error) {
    console.error('=== Family Invitation Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error object:', error);
    console.error('=== End Error Debug ===');
    return c.json({
      error: 'Failed to send family invitation',
      details: error.message,
      stack: error.stack
    }, 500);
  }
});

// Send new account invitation via email
app.post('/api/invitations/new-account', authMiddleware, tenantMiddleware, async (c) => {
  try {
    const { email, recipientEmail, personalMessage } = await c.req.json();
    const emailToUse = email || recipientEmail;
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;

    // Validate email
    if (!emailToUse || !emailToUse.includes('@')) {
      return c.json({ error: 'Valid email address is required' }, 400);
    }

    // Check if user already exists
    const existingUser = await db.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(emailToUse).first();

    if (existingUser) {
      return c.json({ error: 'User with this email already has an account' }, 400);
    }

    // Generate referral code
    const referralCode = `REF_${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

    // Create email invitation record
    const emailInvitationResult = await db.prepare(`
      INSERT INTO email_invitations (
        tenant_id, sent_by_user_id, invitation_type, recipient_email,
        referral_code, email_subject, email_body_html, email_body_text
      ) VALUES (?, ?, 'new_account', ?, ?, 'temp', 'temp', 'temp')
    `).bind(tenant.id, user.userId, emailToUse, referralCode).run();

    const emailInvitationId = emailInvitationResult.meta.last_row_id;

    // Send email
    const emailService = new CloudflareEmailService(c.env);
    const emailResult = await emailService.sendNewAccountInvitation({
      recipientEmail: emailToUse,
      senderName: user.name || getFriendlyNameFromEmail(user.email),
      referralCode,
      personalMessage,
      emailInvitationId
    });

    if (!emailResult.success) {
      console.error('Email sending failed:', emailResult.error);
      return c.json({ error: 'Failed to send invitation email: ' + emailResult.error }, 500);
    }

    // Update email invitation record with actual content
    await db.prepare(`
      UPDATE email_invitations
      SET email_subject = ?, email_body_html = ?, email_body_text = ?,
          metadata = ?
      WHERE id = ?
    `).bind(
      emailResult.subject,
      emailResult.htmlBody,
      emailResult.textBody,
      JSON.stringify({ messageId: emailResult.messageId, threadId: emailResult.threadId }),
      emailInvitationId
    ).run();

    return c.json({
      success: true,
      message: 'New account invitation sent successfully',
      referralCode,
      recipientEmail: email,
      emailInvitationId
    });

  } catch (error) {
    console.error('New account invitation error:', error);
    return c.json({ error: 'Failed to send new account invitation' }, 500);
  }
});

// Get sent invitations
app.get('/api/invitations', authMiddleware, tenantMiddleware, async (c) => {
  try {
    const tenant = c.get('tenant');
    const db = c.env.DB;

    const invitations = await db.prepare(`
      SELECT
        ei.*,
        ic.expires_at as invite_expires_at,
        ic.current_uses as invite_current_uses,
        ic.max_uses as invite_max_uses,
        ic.is_active as invite_is_active
      FROM email_invitations ei
      LEFT JOIN invite_codes ic ON ei.invite_code = ic.code
      WHERE ei.tenant_id = ?
      ORDER BY ei.sent_at DESC
    `).bind(tenant.id).all();

    return c.json({
      success: true,
      invitations: invitations.results || []
    });

  } catch (error) {
    console.error('Get invitations error:', error);
    return c.json({ error: 'Failed to get invitations' }, 500);
  }
});

// Email tracking endpoints

// Track email opens
app.get('/api/invitations/track/open/:emailId', async (c) => {
  try {
    const emailId = c.req.param('emailId');
    const db = c.env.DB;

    // Update opened status
    await db.prepare(`
      UPDATE email_invitations
      SET status = 'opened', opened_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'sent'
    `).bind(emailId).run();

    // Return 1x1 transparent pixel
    const pixel = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);

    return new Response(pixel, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Email tracking error:', error);
    return new Response('', { status: 200 });
  }
});

// Track email clicks
app.get('/api/invitations/track/click/:emailId', async (c) => {
  try {
    const emailId = c.req.param('emailId');
    const db = c.env.DB;

    // Update clicked status
    await db.prepare(`
      UPDATE email_invitations
      SET status = 'clicked', clicked_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(emailId).run();

    // Redirect to registration
    return c.redirect('/register');

  } catch (error) {
    console.error('Click tracking error:', error);
    return c.redirect('/register');
  }
});

// Unsubscribe from emails
app.get('/api/invitations/unsubscribe/:emailId', async (c) => {
  try {
    const emailId = c.req.param('emailId');
    const db = c.env.DB;

    // Mark as unsubscribed (you could add an unsubscribed table)
    await db.prepare(`
      UPDATE email_invitations
      SET metadata = json_set(COALESCE(metadata, '{}'), '$.unsubscribed', true, '$.unsubscribed_at', CURRENT_TIMESTAMP)
      WHERE id = ?
    `).bind(emailId).run();

    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed - PowerMeter</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .container { max-width: 500px; margin: 0 auto; }
          h1 { color: #c27d18; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚡ PowerMeter</h1>
          <h2>You've been unsubscribed</h2>
          <p>You will no longer receive invitation emails from PowerMeter.</p>
          <p><a href="/">Back to PowerMeter</a></p>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return c.text('Error processing unsubscribe request', 500);
  }
});

// Generate shareable invitation link
app.post('/api/invitations/generate-link', authMiddleware, tenantMiddleware, async (c) => {
  try {
    const { recipientEmail, personalMessage } = await c.req.json();
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;

    if (!recipientEmail) {
      return c.json({ error: 'Recipient email is required' }, 400);
    }

    // Generate invite code for the tenant
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase() +
                       Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create invite code record
    const inviteResult = await db.prepare(`
      INSERT INTO invite_codes (
        code, tenant_id, created_by, expires_at, max_uses, current_uses, is_active
      ) VALUES (?, ?, ?, ?, 1, 0, 1)
    `).bind(
      inviteCode,
      tenant.id,
      user.userId,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    ).run();

    // Create shareable token (encoded invitation data)
    const invitationData = {
      senderName: user.name || getFriendlyNameFromEmail(user.email),
      senderEmail: user.email,
      tenantName: tenant.name,
      inviteCode,
      personalMessage: personalMessage || null,
      recipientEmail,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    // Create a simple token (base64 encoded JSON)
    const token = btoa(JSON.stringify(invitationData));
    const inviteUrl = `https://powermeter.app/invite?token=${encodeURIComponent(token)}`;

    // Generate WhatsApp message
    const whatsappMessage = `🌟 *You're invited to PowerMeter!*\n\nHi! ${invitationData.senderName} has invited you to join their family electricity tracking account on PowerMeter.\n\n⚡ *What you'll get:*\n• Track electricity usage together\n• Add vouchers and meter readings\n• See family consumption trends\n• Manage household spending\n\n🔑 *Your invite code:* ${inviteCode}\n\n👆 Click the link to join: ${inviteUrl}\n\n${personalMessage ? `💬 *Personal message:* "${personalMessage}"\n\n` : ''}--\nPowerMeter - Track your electricity usage together! 🏠⚡`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

    // Create email invitation record for tracking
    const emailInvitationId = Math.random().toString(36).substring(2, 15);
    await db.prepare(`
      INSERT INTO email_invitations (
        id, tenant_id, sender_user_id, recipient_email, invitation_type,
        invite_code, email_subject, email_body_html, email_body_text,
        expires_at, sent_at, status, metadata
      ) VALUES (?, ?, ?, ?, 'family', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'link_generated', ?)
    `).bind(
      emailInvitationId,
      tenant.id,
      user.userId,
      recipientEmail,
      inviteCode,
      `Invitation to join ${invitationData.senderName}'s PowerMeter family account`,
      `Generated shareable link: ${inviteUrl}`,
      whatsappMessage,
      invitationData.expiresAt,
      JSON.stringify({ method: 'link', inviteUrl: inviteUrl, whatsappUrl })
    ).run();

    return c.json({
      success: true,
      data: {
        inviteUrl,
        whatsappUrl,
        inviteCode,
        expiresAt: invitationData.expiresAt,
        message: whatsappMessage
      }
    });

  } catch (error) {
    console.error('Generate link error:', error);
    return c.json({ error: 'Failed to generate invitation link' }, 500);
  }
});

// Get invitation details from token (for the invite page)
app.get('/api/invitations/details', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({ error: 'Token is required' }, 400);
    }

    // Decode the token
    let invitationData;
    try {
      invitationData = JSON.parse(atob(token));
    } catch (e) {
      return c.json({ error: 'Invalid token' }, 400);
    }

    // Check if invitation has expired
    if (new Date() > new Date(invitationData.expiresAt)) {
      return c.json({ error: 'Invitation has expired' }, 400);
    }

    // Return invitation details (without sensitive info)
    return c.json({
      success: true,
      data: {
        senderName: invitationData.senderName,
        tenantName: invitationData.tenantName,
        inviteCode: invitationData.inviteCode,
        personalMessage: invitationData.personalMessage,
        expiresAt: invitationData.expiresAt
      }
    });

  } catch (error) {
    console.error('Get invitation details error:', error);
    return c.json({ error: 'Failed to load invitation details' }, 500);
  }
});

// Serve static files from public directory - exclude API routes
app.get('/css/*', serveStatic({ root: './public' }));
app.get('/js/*', serveStatic({ root: './public' }));
app.get('/images/*', serveStatic({ root: './public' }));
app.get('/favicon.ico', serveStatic({ root: './public' }));

// Serve HTML pages
app.get('/', serveStatic({ path: './public/index.html' }));
app.get('/login', serveStatic({ path: './public/login.html' }));
app.get('/register', serveStatic({ path: './public/register.html' }));
app.get('/dashboard', serveStatic({ path: './public/dashboard.html' }));
app.get('/voucher', serveStatic({ path: './public/voucher.html' }));
app.get('/reading', serveStatic({ path: './public/reading.html' }));
app.get('/history', serveStatic({ path: './public/history.html' }));
app.get('/settings', serveStatic({ path: './public/settings.html' }));
app.get('/invite', serveStatic({ path: './public/invite.html' }));

export default app;