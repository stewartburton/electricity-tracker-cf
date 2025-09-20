import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import { cors } from 'hono/cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

    // If invite code was used, add user to the group
    if (groupId) {
      await db.prepare(`
        INSERT INTO user_groups (user_id, group_id, role)
        VALUES (?, ?, 'member')
      `).bind(userId, groupId).run();
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
app.use('/api/readings/*', authMiddleware);
app.use('/api/vouchers/*', authMiddleware);
app.use('/api/dashboard/*', authMiddleware);
app.use('/api/account/*', authMiddleware);
app.use('/api/transactions', authMiddleware);

// Create reading endpoint
app.post('/api/readings', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;
    const { reading_value, reading_date, notes } = await c.req.json();

    // Validate required fields
    if (!reading_value || !reading_date) {
      return c.json({ error: 'Reading value and date are required' }, 400);
    }

    // Insert new reading
    const result = await db.prepare(`
      INSERT INTO readings (user_id, reading_value, reading_date, notes, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(user.userId, reading_value, reading_date, notes || null).run();

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

export default app;