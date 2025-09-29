import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import { cors } from 'hono/cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
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

const RESET_TOKEN_EXPIRY_MINUTES = 60;

function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getBaseUrl(env) {
  const base = env.BASE_URL || 'https://powermeter.app';
  return base.endsWith('/') ? base.slice(0, -1) : base;
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
      // Check if user is a super admin with no tenant association
      const superAdminUser = await db.prepare(`
        SELECT role FROM users WHERE id = ? AND role = 'super_admin'
      `).bind(user.userId).first();

      if (superAdminUser) {
        // Super admin can access without tenant
        c.set('tenant', {
          id: null,
          name: 'System Admin',
          role: 'super_admin',
          subscription_status: 'active'
        });
      } else {
        return c.json({ error: 'No tenant access' }, 403);
      }
    } else {
      c.set('tenant', {
        id: tenantUser.id,
        name: tenantUser.name,
        role: tenantUser.role,
        subscription_status: tenantUser.subscription_status
      });
    }

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

    // Get user's tenant and role information
    const tenantUser = await db.prepare(`
      SELECT t.*, tu.role
      FROM tenants t
      JOIN tenant_users tu ON t.id = tu.tenant_id
      WHERE tu.user_id = ?
    `).bind(user.id).first();

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      c.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user data and token with role information
    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      tenant: tenantUser ? {
        id: tenantUser.id,
        name: tenantUser.name,
        role: tenantUser.role
      } : null,
      redirectTo: tenantUser?.role === 'super_admin' ? '/admin.html' : '/dashboard.html'
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
    const existingUser = await db.prepare('SELECT id, password FROM users WHERE email = ?').bind(email).first();

    let userId = null;
    let isNewUser = false;

    if (existingUser) {
      // User exists - handle based on whether they have invite code
      if (!inviteCode) {
        return c.json({ error: 'User already exists. Please login instead.' }, 409);
      }

      // User exists and has invite code - they might be rejoining a family
      userId = existingUser.id;

      // Validate the password they provided matches their existing account
      const passwordValid = await bcrypt.compare(password, existingUser.password);
      if (!passwordValid) {
        return c.json({ error: 'Invalid password for existing account' }, 401);
      }
    } else {
      // New user - create account
      const hashedPassword = await bcrypt.hash(password, 12);

      const result = await db.prepare(`
        INSERT INTO users (email, password, created_at, updated_at)
        VALUES (?, ?, datetime('now'), datetime('now'))
      `).bind(email, hashedPassword).run();

      if (!result.success) {
        return c.json({ error: 'Failed to create user' }, 500);
      }

      userId = result.meta.last_row_id;
      isNewUser = true;
    }

    if (inviteCode) {
      // Join existing tenant via invite code
      const invite = await db.prepare(`
        SELECT * FROM invite_codes
        WHERE code = ? AND is_active = 1
        AND expires_at > datetime('now')
        AND current_uses < max_uses
      `).bind(inviteCode).first();

      if (invite) {
        // Check if user is already a member of this tenant
        const existingMembership = await db.prepare(`
          SELECT id FROM tenant_users
          WHERE tenant_id = ? AND user_id = ?
        `).bind(invite.tenant_id, userId).first();

        if (existingMembership) {
          return c.json({
            error: 'You are already a member of this family account. Please login instead.',
            suggestion: 'Use the login page to access your account.'
          }, 409);
        }

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
        `).bind(invite.id).run();
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

app.post('/api/auth/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();

    if (typeof email !== 'string' || !email.trim()) {
      return c.json({
        success: true,
        message: 'If that email address exists in our system, a password reset link has been sent.',
        emailDispatched: false
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const db = c.env.DB;

    await db.prepare(`
      DELETE FROM password_reset_tokens
      WHERE expires_at < datetime('now')
    `).run();

    const user = await db.prepare(`
      SELECT id, email
      FROM users
      WHERE LOWER(email) = ?
    `).bind(normalizedEmail).first();

    if (!user) {
      return c.json({
        success: true,
        message: 'If that email address exists in our system, a password reset link has been sent.',
        emailDispatched: false
      });
    }

    await db.prepare(`
      DELETE FROM password_reset_tokens
      WHERE user_id = ?
    `).bind(user.id).run();

    const token = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const requestIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
    const userAgent = c.req.header('User-Agent') || null;

    await db.prepare(`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip, requested_user_agent)
      VALUES (?, ?, ?, ?, ?)
    `).bind(user.id, tokenHash, expiresAt, requestIp, userAgent).run();

    const emailService = new CloudflareEmailService(c.env);
    const baseUrl = getBaseUrl(c.env);
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    let emailDispatched = false;

    try {
      const emailResult = await emailService.sendPasswordResetEmail({
        recipientEmail: user.email,
        friendlyName: getFriendlyNameFromEmail(user.email),
        resetUrl,
        expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
        baseUrl,
        productName: 'PowerMeter'
      });

      if (!emailResult.success) {
        console.error('Password reset email send failed:', emailResult.error);
      } else {
        emailDispatched = true;
      }
    } catch (emailError) {
      console.error('Password reset email error:', emailError);
    }

    const responsePayload = {
      success: true,
      message: 'If that email address exists in our system, a password reset link has been sent.',
      emailDispatched
    };

    if (c.env.ENABLE_RESET_TOKEN_DEBUG === 'true') {
      responsePayload.debugToken = token;
    }

    return c.json(responsePayload);
  } catch (error) {
    console.error('Forgot password error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/api/auth/reset-password/validate', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({ error: 'Token is required' }, 400);
    }

    const tokenHash = hashPasswordResetToken(token);
    const db = c.env.DB;

    const tokenRecord = await db.prepare(`
      SELECT prt.*, u.email
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token_hash = ?
      ORDER BY prt.created_at DESC
      LIMIT 1
    `).bind(tokenHash).first();

    if (!tokenRecord) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }

    if (tokenRecord.used_at) {
      return c.json({ error: 'This reset link has already been used' }, 400);
    }

    const expiresAt = new Date(tokenRecord.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }

    return c.json({
      success: true,
      valid: true,
      email: tokenRecord.email
    });
  } catch (error) {
    console.error('Validate reset token error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/auth/reset-password', async (c) => {
  try {
    const { token, password } = await c.req.json();

    if (typeof token !== 'string' || !token.trim() || typeof password !== 'string') {
      return c.json({ error: 'Token and new password are required' }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    const tokenHash = hashPasswordResetToken(token.trim());
    const db = c.env.DB;

    const tokenRecord = await db.prepare(`
      SELECT prt.*, u.email
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token_hash = ?
      ORDER BY prt.created_at DESC
      LIMIT 1
    `).bind(tokenHash).first();

    if (!tokenRecord) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }

    if (tokenRecord.used_at) {
      return c.json({ error: 'This reset link has already been used' }, 400);
    }

    const expiresAt = new Date(tokenRecord.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.prepare(`
      UPDATE users
      SET password = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(hashedPassword, tokenRecord.user_id).run();

    await db.prepare(`
      UPDATE password_reset_tokens
      SET used_at = datetime('now')
      WHERE id = ?
    `).bind(tokenRecord.id).run();

    await db.prepare(`
      DELETE FROM password_reset_tokens
      WHERE user_id = ? AND id != ?
    `).bind(tokenRecord.user_id, tokenRecord.id).run();

    return c.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Password reset error:', error);
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

// Super Admin Setup - Create dedicated admin account
app.post('/api/setup/create-super-admin', async (c) => {
  try {
    const { username, email, password, setupKey } = await c.req.json();
    const db = c.env.DB;

    // Validate setup key (you should set this in environment variables)
    const expectedSetupKey = c.env.SUPER_ADMIN_SETUP_KEY || 'your-super-secret-setup-key-2025';
    if (setupKey && setupKey !== expectedSetupKey) {
      return c.json({ error: 'Invalid setup key' }, 403);
    }

    if ((!username && !email) || !password) {
      return c.json({ error: 'Username/email and password are required' }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters long' }, 400);
    }

    const accountEmail = email || username;

    // Check if super admin already exists
    const existingAdmin = await db.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(accountEmail).first();

    if (existingAdmin) {
      return c.json({ error: 'Super admin already exists' }, 409);
    }

    // Create super admin user
    const hashedPassword = await bcrypt.hash(password, 12);
    const userResult = await db.prepare(`
      INSERT INTO users (email, password, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).bind(accountEmail, hashedPassword).run();

    if (!userResult.success) {
      return c.json({ error: 'Failed to create super admin user' }, 500);
    }

    const userId = userResult.meta.last_row_id;

    // Create dedicated admin tenant
    const tenantResult = await db.prepare(`
      INSERT INTO tenants (name, created_at, updated_at)
      VALUES ('System Administration', datetime('now'), datetime('now'))
    `).bind().run();

    if (!tenantResult.success) {
      return c.json({ error: 'Failed to create admin tenant' }, 500);
    }

    const tenantId = tenantResult.meta.last_row_id;

    // Add user to admin tenant with super_admin role
    await db.prepare(`
      INSERT INTO tenant_users (tenant_id, user_id, role, joined_at)
      VALUES (?, ?, 'super_admin', datetime('now'))
    `).bind(tenantId, userId).run();

    return c.json({
      success: true,
      message: 'Super admin account created successfully',
      user: {
        id: userId,
        email: accountEmail,
        role: 'super_admin',
        tenantId: tenantId
      }
    });

  } catch (error) {
    console.error('Super admin creation error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return c.json({
      error: 'Failed to create super admin account',
      details: error.message
    }, 500);
  }
});

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
    const tenant = c.get('tenant');
    const db = c.env.DB;
    const { id } = c.req.param();

    if (!id) {
      return c.json({ error: 'Reading ID is required' }, 400);
    }

    // First check if reading exists and belongs to tenant (family)
    const reading = await db.prepare(`
      SELECT * FROM readings WHERE id = ? AND tenant_id = ?
    `).bind(id, tenant.id).first();

    if (!reading) {
      return c.json({
        success: false,
        error: 'Reading not found or access denied'
      }, 404);
    }

    // Delete the reading (any family member can delete readings in their tenant)
    const result = await db.prepare(`
      DELETE FROM readings WHERE id = ? AND tenant_id = ?
    `).bind(id, tenant.id).run();

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

// Parse SMS voucher endpoint
app.post('/api/vouchers/parse-sms', async (c) => {
  try {
    const { smsText } = await c.req.json();

    if (!smsText) {
      return c.json({
        success: false,
        error: 'SMS text is required'
      }, 400);
    }

    // Parse FNB SMS format
    // Example: "FNB :-) Cape Town. Elec Amt: R86.96. Vat Amt: R13.04. Meter: 09000490491. Credit Token: 1393-1590-8399-0790-1839. Units: 29.7kWh."

    const patterns = {
      // Match electricity amount: "Elec Amt: R86.96"
      amount: /Elec Amt:\s*R?([\d.]+)/i,

      // Match VAT amount: "Vat Amt: R13.04"
      vat: /Vat Amt:\s*R?([\d.]+)/i,

      // Match units: "Units: 29.7kWh"
      units: /Units:\s*([\d.]+)(?:kWh?)?/i,

      // Match credit token: "Credit Token: 1393-1590-8399-0790-1839"
      token: /Credit Token:\s*([\d-]+)/i,

      // Match meter number: "Meter: 09000490491"
      meter: /Meter:\s*(\d+)/i
    };

    const parsed = {};
    let hasMatches = false;

    // Extract amount
    const amountMatch = smsText.match(patterns.amount);
    if (amountMatch) {
      parsed.amount = parseFloat(amountMatch[1]);
      hasMatches = true;
    }

    // Extract VAT
    const vatMatch = smsText.match(patterns.vat);
    if (vatMatch) {
      parsed.vat = parseFloat(vatMatch[1]);
      hasMatches = true;
    }

    // Extract units
    const unitsMatch = smsText.match(patterns.units);
    if (unitsMatch) {
      parsed.units = parseFloat(unitsMatch[1]);
      hasMatches = true;
    }

    // Extract token
    const tokenMatch = smsText.match(patterns.token);
    if (tokenMatch) {
      parsed.token = tokenMatch[1];
      hasMatches = true;
    }

    // Extract meter (for notes)
    const meterMatch = smsText.match(patterns.meter);
    if (meterMatch) {
      parsed.note = `Meter: ${meterMatch[1]}`;
      hasMatches = true;
    }

    if (!hasMatches) {
      return c.json({
        success: false,
        error: 'The string did not match the expected pattern.'
      }, 400);
    }

    return c.json({
      success: true,
      message: 'SMS parsed successfully',
      ...parsed
    });

  } catch (error) {
    console.error('SMS parsing error:', error);
    return c.json({
      success: false,
      error: 'Failed to parse SMS'
    }, 500);
  }
});

// Create voucher endpoint
app.post('/api/vouchers', async (c) => {
  try {
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;
    const { token, purchase_date, amount, units, vat, notes } = await c.req.json();

    // Validate required fields
    if (!token || !purchase_date || !amount || !units) {
      return c.json({ error: 'Token number, purchase date, amount, and units are required' }, 400);
    }

    // Insert new voucher with tenant isolation
    const result = await db.prepare(`
      INSERT INTO vouchers (user_id, tenant_id, token_number, purchase_date, rand_amount, kwh_amount, vat_amount, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(user.userId, tenant.id, token, purchase_date, amount, units, vat || 0, notes || null).run();

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
    const tenant = c.get('tenant');
    const db = c.env.DB;
    const { id } = c.req.param();

    if (!id) {
      return c.json({ error: 'Voucher ID is required' }, 400);
    }

    // First check if voucher exists and belongs to tenant (family)
    const voucher = await db.prepare(`
      SELECT * FROM vouchers WHERE id = ? AND tenant_id = ?
    `).bind(id, tenant.id).first();

    if (!voucher) {
      return c.json({
        success: false,
        error: 'Voucher not found or access denied'
      }, 404);
    }

    // Delete the voucher (any family member can delete vouchers in their tenant)
    const result = await db.prepare(`
      DELETE FROM vouchers WHERE id = ? AND tenant_id = ?
    `).bind(id, tenant.id).run();

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

// Super Admin Dashboard - separate endpoint with platform-wide metrics
app.get('/api/dashboard/admin', authMiddleware, superAdminMiddleware, async (c) => {
  try {
    const db = c.env.DB;

    // Get platform-wide voucher statistics
    const voucherResult = await db.prepare(`
      SELECT
        COALESCE(SUM(rand_amount), 0) as total_amount,
        COALESCE(SUM(kwh_amount), 0) as total_units,
        COALESCE(SUM(vat_amount), 0) as total_vat,
        COUNT(*) as total_vouchers
      FROM readings
      WHERE type = 'voucher'
    `).first();

    // Calculate average cost per kWh
    const avgCostPerKwh = voucherResult.total_units > 0 ?
      voucherResult.total_amount / voucherResult.total_units : 0;

    // Get recent vouchers across all tenants
    const recentVouchers = await db.prepare(`
      SELECT r.*, t.name as tenant_name, u.email as user_email
      FROM readings r
      LEFT JOIN tenants t ON r.tenant_id = t.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.type = 'voucher'
      ORDER BY r.purchase_date DESC
      LIMIT 5
    `).all();

    // Get recent readings across all tenants
    const recentReadings = await db.prepare(`
      SELECT r.*, t.name as tenant_name, u.email as user_email
      FROM readings r
      LEFT JOIN tenants t ON r.tenant_id = t.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.type = 'reading'
      ORDER BY r.reading_date DESC
      LIMIT 5
    `).all();

    // Get monthly data for the last 6 months across all tenants
    const monthlyData = await db.prepare(`
      SELECT
        strftime('%Y-%m', purchase_date) as month,
        SUM(rand_amount) as amount,
        SUM(kwh_amount) as kwh,
        COUNT(*) as voucher_count
      FROM readings
      WHERE type = 'voucher'
        AND purchase_date >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', purchase_date)
      ORDER BY month DESC
    `).all();

    // Get platform statistics
    const platformStats = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM tenants) as total_families,
        (SELECT COUNT(*) FROM readings WHERE type = 'reading') as total_readings,
        (SELECT COUNT(*) FROM readings WHERE created_at >= date('now', '-30 days')) as recent_activity
    `).first();

    return c.json({
      success: true,
      type: 'super_admin_dashboard',
      totalVouchers: voucherResult.total_vouchers || 0,
      totalAmount: voucherResult.total_amount || 0,
      totalUnits: voucherResult.total_units || 0,
      totalVat: voucherResult.total_vat || 0,
      avgCostPerKwh: avgCostPerKwh || 0,
      totalUsers: platformStats.total_users || 0,
      totalFamilies: platformStats.total_families || 0,
      totalReadings: platformStats.total_readings || 0,
      recentActivity: platformStats.recent_activity || 0,
      recentVouchers: recentVouchers?.results || [],
      recentReadings: recentReadings?.results || [],
      monthlyData: monthlyData?.results || [],
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Super admin dashboard error:', error);
    return c.json({ error: 'Failed to fetch admin dashboard data' }, 500);
  }
});

// Regular Dashboard endpoint (tenant-based only)
app.get('/api/dashboard', authMiddleware, tenantMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;

    // Regular tenant-scoped dashboard - super admins should use /api/dashboard/admin
    // Handle case where user has no tenant
    if (!tenant.id) {
      return c.json({
        success: true,
        totalVouchers: 0,
        totalAmount: 0,
        totalUnits: 0,
        totalVat: 0,
        avgCostPerKwh: 0,
        recentVouchers: [],
        recentReadings: [],
        monthlyData: [],
        tenantName: tenant.role === 'super_admin' ? 'Use Admin Dashboard' : 'No Family',
        userRole: tenant.role,
        message: tenant.role === 'super_admin' ?
          'Super admins should use the admin dashboard for platform metrics' :
          'No family data available'
      });
    }

    // Process tenant-scoped dashboard data
    const voucherResult = await db.prepare(`
        SELECT
          COALESCE(SUM(rand_amount), 0) as total_amount,
          COALESCE(SUM(kwh_amount), 0) as total_units,
          COALESCE(SUM(vat_amount), 0) as total_vat,
          COUNT(*) as total_vouchers
        FROM readings
        WHERE tenant_id = ? AND type = 'voucher'
      `).bind(tenant.id).first();

      // Calculate average cost per kWh
      const avgCostPerKwh = voucherResult.total_units > 0 ?
        voucherResult.total_amount / voucherResult.total_units : 0;

      // Get recent vouchers for the tenant (family)
      const recentVouchers = await db.prepare(`
        SELECT * FROM readings
        WHERE tenant_id = ? AND type = 'voucher'
        ORDER BY purchase_date DESC
        LIMIT 5
      `).bind(tenant.id).all();

      // Get recent readings for the tenant (family)
      const recentReadings = await db.prepare(`
        SELECT * FROM readings
        WHERE tenant_id = ? AND type = 'reading'
        ORDER BY reading_date DESC
        LIMIT 5
      `).bind(tenant.id).all();

      // Get monthly data for the last 6 months for the tenant (family)
      const monthlyData = await db.prepare(`
        SELECT
          strftime('%Y-%m', purchase_date) as month,
          SUM(rand_amount) as amount,
          SUM(kwh_amount) as kwh
        FROM readings
        WHERE tenant_id = ? AND type = 'voucher'
          AND purchase_date >= date('now', '-6 months')
        GROUP BY strftime('%Y-%m', purchase_date)
        ORDER BY month DESC
      `).bind(tenant.id).all();

    return c.json({
      success: true,
      totalVouchers: voucherResult.total_vouchers || 0,
      totalAmount: voucherResult.total_amount || 0,
      totalUnits: voucherResult.total_units || 0,
      totalVat: voucherResult.total_vat || 0,
      avgCostPerKwh: avgCostPerKwh || 0,
      recentVouchers: recentVouchers?.results || [],
      recentReadings: recentReadings?.results || [],
      monthlyData: monthlyData?.results || [],
      tenantName: tenant.name,
      userRole: tenant.role
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json({ error: 'Failed to fetch dashboard data' }, 500);
  }
});

// Dashboard stats (tenant-based or super admin aggregate)
app.get('/api/dashboard/stats', authMiddleware, tenantMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;

    const isSuperAdmin = tenant?.role === 'super_admin';

    if (isSuperAdmin) {
      // Super admin sees aggregate stats across ALL users/tenants
      const voucherResult = await db.prepare(`
        SELECT
          COALESCE(SUM(rand_amount), 0) as total_purchased,
          COALESCE(SUM(kwh_amount), 0) as total_kwh_purchased,
          COUNT(*) as voucher_count
        FROM readings
        WHERE type = 'voucher'
      `).first();

      // Get reading data across all tenants
      const readingResult = await db.prepare(`
        SELECT
          COUNT(*) as reading_count,
          MIN(reading_value) as lowest_reading,
          MAX(reading_value) as highest_reading,
          AVG(reading_value) as avg_reading
        FROM readings
        WHERE type = 'reading'
      `).first();

      // Get recent vouchers across all tenants
      const recentVouchers = await db.prepare(`
        SELECT
          'voucher' as type,
          r.rand_amount as amount,
          r.kwh_amount,
          r.token_number,
          r.purchase_date as date,
          r.created_at,
          r.notes,
          t.name as tenant_name
        FROM readings r
        LEFT JOIN tenants t ON r.tenant_id = t.id
        WHERE r.type = 'voucher'
        ORDER BY r.purchase_date DESC
        LIMIT 3
      `).all();

      const recentReadings = await db.prepare(`
        SELECT
          'reading' as type,
          r.reading_value as amount,
          r.reading_date as date,
          r.created_at,
          r.notes,
          t.name as tenant_name
        FROM readings r
        LEFT JOIN tenants t ON r.tenant_id = t.id
        WHERE r.type = 'reading'
        ORDER BY r.reading_date DESC
        LIMIT 3
      `).all();

      // Get platform stats for super admin
      const platformStats = await db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM tenants) as total_families
      `).first();

      return c.json({
        success: true,
        isSuperAdmin: true,
        data: {
          totalPurchased: voucherResult.total_purchased || 0,
          totalKwhPurchased: voucherResult.total_kwh_purchased || 0,
          voucherCount: voucherResult.voucher_count || 0,
          readingCount: readingResult.reading_count || 0,
          lowestReading: readingResult.lowest_reading || 0,
          highestReading: readingResult.highest_reading || 0,
          avgReading: readingResult.avg_reading || 0,
          totalUsers: platformStats.total_users || 0,
          totalFamilies: platformStats.total_families || 0,
          recentVouchers: recentVouchers?.results || [],
          recentReadings: recentReadings?.results || []
        }
      });
    } else {
      // Regular tenant-scoped stats with updated schema
      // Handle case where super admin has no tenant
      if (!tenant.id) {
        return c.json({
          success: true,
          isSuperAdmin: false,
          data: {
            totalPurchased: 0,
            totalKwhPurchased: 0,
            voucherCount: 0,
            readingCount: 0,
            lowestReading: 0,
            highestReading: 0,
            avgReading: 0,
            recentVouchers: [],
            recentReadings: [],
            linkedAccountCount: 0
          }
        });
      }

      const voucherResult = await db.prepare(`
        SELECT
          COALESCE(SUM(rand_amount), 0) as total_purchased,
          COALESCE(SUM(kwh_amount), 0) as total_kwh_purchased,
          COUNT(*) as voucher_count
        FROM readings
        WHERE tenant_id = ? AND type = 'voucher'
      `).bind(tenant.id).first();

      // Get reading data for the tenant (family)
      const readingResult = await db.prepare(`
        SELECT
          COUNT(*) as reading_count,
          MIN(reading_value) as lowest_reading,
          MAX(reading_value) as highest_reading,
          AVG(reading_value) as avg_reading
        FROM readings
        WHERE tenant_id = ? AND type = 'reading'
      `).bind(tenant.id).first();

      // Get recent vouchers for the tenant (family)
      const recentVouchers = await db.prepare(`
        SELECT
          'voucher' as type,
          rand_amount as amount,
          kwh_amount,
          token_number,
          purchase_date as date,
          created_at,
          notes
        FROM readings
        WHERE tenant_id = ? AND type = 'voucher'
        ORDER BY purchase_date DESC
        LIMIT 3
      `).bind(tenant.id).all();

      const recentReadings = await db.prepare(`
        SELECT
          'reading' as type,
          reading_value as amount,
          reading_date as date,
          created_at,
          notes
        FROM readings
        WHERE tenant_id = ? AND type = 'reading'
        ORDER BY reading_date DESC
        LIMIT 3
      `).bind(tenant.id).all();

      // Get linked account count for the tenant
      const linkedAccounts = await db.prepare(`
        SELECT COUNT(*) as count
        FROM tenant_users
        WHERE tenant_id = ?
      `).bind(tenant.id).first();

      return c.json({
        success: true,
        isSuperAdmin: false,
        data: {
          totalPurchased: voucherResult.total_purchased || 0,
          totalKwhPurchased: voucherResult.total_kwh_purchased || 0,
          voucherCount: voucherResult.voucher_count || 0,
          readingCount: readingResult.reading_count || 0,
          lowestReading: readingResult.lowest_reading || 0,
          highestReading: readingResult.highest_reading || 0,
          avgReading: readingResult.avg_reading || 0,
          recentVouchers: recentVouchers?.results || [],
          recentReadings: recentReadings?.results || [],
          linkedAccountCount: linkedAccounts.count || 0
        }
      });
    }

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

    // Get account info with tenant details using new schema
    const accountInfo = await db.prepare(`
      SELECT
        u.id,
        u.email,
        u.created_at,
        t.id as tenant_id,
        t.name as tenant_name,
        tu.role,
        u.created_at as joined_at
      FROM users u
      LEFT JOIN tenant_users tu ON u.id = tu.user_id
      LEFT JOIN tenants t ON tu.tenant_id = t.id
      WHERE u.id = ?
    `).bind(user.userId).first();

    // Get invite code for this tenant
    let inviteCode = null;
    if (accountInfo.tenant_id) {
      const inviteResult = await db.prepare(`
        SELECT code FROM invite_codes
        WHERE tenant_id = ? AND is_active = 1
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(accountInfo.tenant_id).first();
      inviteCode = inviteResult?.code || null;
    }

    // Get linked accounts if in a tenant
    let linkedAccounts = [];
    if (accountInfo.tenant_id) {
      const linkedResult = await db.prepare(`
        SELECT
          u.id as user_id,
          u.email,
          tu.role,
          u.created_at as joined_at
        FROM tenant_users tu
        JOIN users u ON tu.user_id = u.id
        WHERE tu.tenant_id = ?
        ORDER BY u.created_at ASC
      `).bind(accountInfo.tenant_id).all();

      linkedAccounts = linkedResult.results || [];
    }

    return c.json({
      success: true,
      data: {
        user: {
          id: accountInfo.id,
          email: accountInfo.email,
          created_at: accountInfo.created_at,
          role: accountInfo.role
        },
        group: accountInfo.tenant_id ? {
          id: accountInfo.tenant_id,
          name: accountInfo.tenant_name,
          invite_code: inviteCode,
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

// Account profile endpoint for admin navigation
app.get('/api/account/profile', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;

    // Get user's tenant and role information
    const tenantInfo = await db.prepare(`
      SELECT
        t.id,
        t.name,
        tu.role
      FROM tenant_users tu
      JOIN tenants t ON tu.tenant_id = t.id
      WHERE tu.user_id = ?
    `).bind(user.userId).first();

    if (tenantInfo) {
      return c.json({
        success: true,
        user: {
          id: user.userId,
          email: user.email
        },
        tenant: {
          id: tenantInfo.id,
          name: tenantInfo.name,
          role: tenantInfo.role
        }
      });
    } else {
      // Check if user is a super admin without tenant association
      const superAdminCheck = await db.prepare(`
        SELECT role FROM users WHERE id = ? AND role = 'super_admin'
      `).bind(user.userId).first();

      if (superAdminCheck) {
        return c.json({
          success: true,
          user: {
            id: user.userId,
            email: user.email
          },
          tenant: {
            id: null,
            name: 'System Admin',
            role: 'super_admin'
          }
        });
      } else {
        return c.json({
          success: true,
          user: {
            id: user.userId,
            email: user.email
          },
          tenant: null
        });
      }
    }
  } catch (error) {
    console.error('Account profile error:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
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

// Transactions endpoint for history page (tenant-based)
app.get('/api/transactions', async (c) => {
  try {
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;

    // Get month filter if provided
    const month = c.req.query('month');
    let dateFilter = '';
    let readingDateFilter = '';

    if (month) {
      dateFilter = `AND strftime('%Y-%m', purchase_date) = '${month}'`;
      readingDateFilter = `AND strftime('%Y-%m', reading_date) = '${month}'`;
      console.log(`Filtering by month: ${month}, dateFilter: ${dateFilter}, readingDateFilter: ${readingDateFilter}`);
    }

    // Get vouchers for the tenant (family) - use actual purchase_date for timestamp
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
      WHERE tenant_id = ? ${dateFilter}
      ORDER BY purchase_date DESC
    `).bind(tenant.id).all();

    // Get readings for the tenant (family) - use actual reading_date for timestamp
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
      WHERE tenant_id = ? ${readingDateFilter}
      ORDER BY reading_date DESC
    `).bind(tenant.id).all();
    

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
      ) VALUES (?, ?, 'referral', ?, ?, 'temp', 'temp', 'temp', ?)
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
      emailInvitationId,
      registrationUrl: `https://powermeter.app/register?invite=${encodeURIComponent(inviteCode)}&email=${encodeURIComponent(emailToUse)}`,
      unsubscribeUrl: `https://powermeter.app/api/invitations/unsubscribe/${emailInvitationId}`
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
      data: invitations.results || []
    });

  } catch (error) {
    console.error('Get invitations error:', error);
    return c.json({ error: 'Failed to get invitations' }, 500);
  }
});

// Clear all sent invitations for the tenant
app.post('/api/invitations/clear', authMiddleware, tenantMiddleware, async (c) => {
  try {
    const tenant = c.get('tenant');
    const db = c.env.DB;

    // Count existing invitations before deletion
    const countResult = await db.prepare(`
      SELECT COUNT(*) as count FROM email_invitations
      WHERE tenant_id = ?
    `).bind(tenant.id).first();

    const existingCount = countResult.count || 0;

    if (existingCount === 0) {
      return c.json({
        success: true,
        deletedCount: 0,
        message: 'No invitations to clear'
      });
    }

    // Delete all email invitations for this tenant
    await db.prepare(`
      DELETE FROM email_invitations
      WHERE tenant_id = ?
    `).bind(tenant.id).run();

    return c.json({
      success: true,
      deletedCount: existingCount,
      message: `Successfully cleared ${existingCount} invitation records`
    });

  } catch (error) {
    console.error('Clear invitations error:', error);
    return c.json({ error: 'Failed to clear invitations' }, 500);
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

    // Create email invitation record for tracking (let id auto-increment)
    await db.prepare(`
      INSERT INTO email_invitations (
        tenant_id, sent_by_user_id, recipient_email, invitation_type,
        invite_code, email_subject, email_body_html, email_body_text,
        expires_at, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?)
    `).bind(
      tenant.id,
      user.userId,
      'whatsapp-shareable-link',
      'new_account',
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

// Get family members
app.get('/api/family/members', authMiddleware, tenantMiddleware, async (c) => {
  try {
    const tenant = c.get('tenant');
    const db = c.env.DB;

    // Admin-only endpoint
    if (tenant.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const members = await db.prepare(`
      SELECT
        tu.user_id,
        tu.role,
        tu.joined_at,
        u.email
      FROM tenant_users tu
      JOIN users u ON tu.user_id = u.id
      WHERE tu.tenant_id = ?
      ORDER BY tu.joined_at ASC
    `).bind(tenant.id).all();

    return c.json(members.results || []);
  } catch (error) {
    console.error('Error fetching family members:', error);
    return c.json({ error: 'Failed to fetch family members' }, 500);
  }
});

// Fix family invite endpoint to match admin page expectations
app.post('/api/family/invite', authMiddleware, tenantMiddleware, async (c) => {
  try {
    const { email, message } = await c.req.json();
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;

    // Admin role validation
    if (tenant.role !== 'admin') {
      return c.json({ error: 'Admin role required to send family invitations' }, 403);
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return c.json({ error: 'Valid email address is required' }, 400);
    }

    // Generate unique invitation link (reuse existing invitation system)
    const invitationData = {
      type: 'family',
      tenantId: tenant.id,
      tenantName: tenant.name,
      inviterEmail: user.email,
      inviterName: user.email.split('@')[0],
      message: message || null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    const token = btoa(JSON.stringify(invitationData));
    const baseUrl = getBaseUrl(c.env);
    const invitationUrl = `${baseUrl}/invite?token=${encodeURIComponent(token)}`;

    // Send email using existing email service
    const emailService = new CloudflareEmailService(c.env);

    const emailResult = await emailService.sendFamilyInvitation({
      recipientEmail: email,
      inviterName: user.email.split('@')[0],
      familyName: tenant.name,
      invitationUrl,
      message: message || '',
      baseUrl
    });

    if (emailResult.success) {
      return c.json({
        success: true,
        message: 'Family invitation sent successfully',
        invitationUrl
      });
    } else {
      throw new Error(emailResult.error || 'Failed to send invitation email');
    }

  } catch (error) {
    console.error('Error sending family invitation:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to send family invitation'
    }, 500);
  }
});

// Fix remove member endpoint to match admin page expectations
app.delete('/api/family/remove/:userId', authMiddleware, tenantMiddleware, async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'));
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;

    // Validate admin role
    if (tenant.role !== 'admin') {
      return c.json({ error: 'Admin role required to remove family members' }, 403);
    }

    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400);
    }

    // Prevent admin from removing themselves
    if (userId === user.userId) {
      return c.json({ error: 'Cannot remove yourself from the family' }, 400);
    }

    // Check if user exists in this tenant
    const memberToRemove = await db.prepare(`
      SELECT tu.*, u.email
      FROM tenant_users tu
      JOIN users u ON tu.user_id = u.id
      WHERE tu.user_id = ? AND tu.tenant_id = ?
    `).bind(userId, tenant.id).first();

    if (!memberToRemove) {
      return c.json({ error: 'User is not a member of this family' }, 404);
    }

    // Remove the user from the tenant
    const result = await db.prepare(`
      DELETE FROM tenant_users
      WHERE user_id = ? AND tenant_id = ?
    `).bind(userId, tenant.id).run();

    if (result.success) {
      return c.json({
        success: true,
        message: `Successfully removed ${memberToRemove.email} from the family`
      });
    } else {
      throw new Error('Failed to remove family member');
    }

  } catch (error) {
    console.error('Error removing family member:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to remove family member'
    }, 500);
  }
});

// Remove family member from tenant (LEGACY - keeping for compatibility)
app.post('/api/family/remove-member', authMiddleware, tenantMiddleware, async (c) => {
  try {
    const { userId } = await c.req.json();
    const user = c.get('user');
    const tenant = c.get('tenant');
    const db = c.env.DB;

    console.log('=== Remove Member Debug ===');
    console.log('User:', user?.userId, user?.email);
    console.log('Tenant:', tenant?.id, tenant?.name, tenant?.role);
    console.log('Target user ID:', userId);

    // Validate admin role
    if (tenant.role !== 'admin') {
      console.log('Permission denied - user role is:', tenant.role, 'but admin required');
      return c.json({ error: 'Admin role required to remove family members' }, 403);
    }

    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400);
    }

    // Prevent admin from removing themselves
    if (userId === user.userId) {
      return c.json({ error: 'Cannot remove yourself from the family' }, 400);
    }

    // Check if user exists in this tenant
    const memberToRemove = await db.prepare(`
      SELECT tu.*, u.email
      FROM tenant_users tu
      JOIN users u ON tu.user_id = u.id
      WHERE tu.tenant_id = ? AND tu.user_id = ?
    `).bind(tenant.id, userId).first();

    console.log('Member to remove:', memberToRemove);

    if (!memberToRemove) {
      console.log('Member not found in tenant');
      return c.json({ error: 'User is not a member of this family' }, 404);
    }

    // Note: We allow admins to remove other admins, but not themselves (already checked above)
    // This allows family management flexibility while preventing self-removal

    console.log('Proceeding with removal - member role is:', memberToRemove.role);

    // Check if user is a member of any other tenants
    const otherTenantMemberships = await db.prepare(`
      SELECT COUNT(*) as count FROM tenant_users
      WHERE user_id = ? AND tenant_id != ?
    `).bind(userId, tenant.id).first();

    console.log('User has other tenant memberships:', otherTenantMemberships.count);

    if (otherTenantMemberships.count === 0) {
      // User is only in this tenant, so delete the user entirely
      console.log('Deleting user entirely (no other tenants)');

      // Delete from tenant_users first (foreign key constraint)
      await db.prepare(`
        DELETE FROM tenant_users
        WHERE tenant_id = ? AND user_id = ?
      `).bind(tenant.id, userId).run();

      // Delete the user record
      await db.prepare(`
        DELETE FROM users
        WHERE id = ?
      `).bind(userId).run();

      console.log('User completely deleted');
    } else {
      // User is in other tenants, just remove from this tenant
      console.log('User has other tenants, just removing from this tenant');
      await db.prepare(`
        DELETE FROM tenant_users
        WHERE tenant_id = ? AND user_id = ?
      `).bind(tenant.id, userId).run();
    }

    return c.json({
      success: true,
      message: `${memberToRemove.email} has been removed from the family`,
      removedUser: {
        email: memberToRemove.email,
        userId: userId
      }
    });

  } catch (error) {
    console.error('Remove family member error:', error);
    return c.json({ error: 'Failed to remove family member' }, 500);
  }
});

// ============================================================================
// COMPREHENSIVE ADMIN API ENDPOINTS - SUPER ADMIN ONLY
// ============================================================================

// Admin middleware - requires super_admin role
const superAdminMiddleware = async (c, next) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const db = c.env.DB;

    // Check for super admin in tenant_users table first
    const tenantAdminCheck = await db.prepare(`
      SELECT tu.role FROM tenant_users tu
      WHERE tu.user_id = ? AND tu.role = 'super_admin'
    `).bind(user.userId).first();

    // If not found in tenant_users, check users table directly
    const userAdminCheck = await db.prepare(`
      SELECT role FROM users
      WHERE id = ? AND role = 'super_admin'
    `).bind(user.userId).first();

    if (!tenantAdminCheck && !userAdminCheck) {
      return c.json({ error: 'Super admin access required' }, 403);
    }

    await next();
  } catch (error) {
    console.error('Super admin middleware error:', error);
    return c.json({ error: 'Access denied' }, 403);
  }
};

// Apply admin middleware to all admin routes
app.use('/api/admin/*', authMiddleware, superAdminMiddleware);

// ADMIN HISTORY - Get transactions for any user (super admin only)
app.get('/api/admin/history/:userId', async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'));
    const month = c.req.query('month');
    const db = c.env.DB;

    if (!userId || isNaN(userId)) {
      return c.json({ error: 'Valid user ID is required' }, 400);
    }

    // Verify user exists
    const user = await db.prepare('SELECT id, email FROM users WHERE id = ?').bind(userId).first();
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Build query with optional month filter
    let query = `
      SELECT
        r.id,
        r.type,
        r.amount,
        r.reading,
        r.created_at,
        r.notes,
        t.name as tenant_name
      FROM readings r
      LEFT JOIN tenants t ON r.tenant_id = t.id
      WHERE r.user_id = ?
    `;

    const params = [userId];

    if (month) {
      query += ` AND DATE(r.created_at) >= ? AND DATE(r.created_at) < ?`;
      const startDate = `${month}-01`;
      const endDate = new Date(month + '-01');
      endDate.setMonth(endDate.getMonth() + 1);
      const endDateStr = endDate.toISOString().split('T')[0];
      params.push(startDate, endDateStr);
    }

    query += ` ORDER BY r.created_at DESC LIMIT 100`;

    const transactions = await db.prepare(query).bind(...params).all();

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email
        },
        transactions: transactions.results || [],
        totalCount: transactions.results?.length || 0
      }
    });

  } catch (error) {
    console.error('Admin history error:', error);
    return c.json({ error: 'Failed to fetch user history' }, 500);
  }
});

// 1. SYSTEM OVERVIEW & METRICS
app.get('/api/admin/system/overview', async (c) => {
  try {
    const db = c.env.DB;

    // Get comprehensive electricity tracking admin metrics
    const [
      userStats,
      familyStats,
      electricityStats,
      financialStats,
      activityStats
    ] = await Promise.all([
      // Active users and growth
      db.prepare(`
        SELECT
          COUNT(*) as totalUsers,
          COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as newUsersWeek,
          COUNT(CASE WHEN created_at > datetime('now', '-30 days') THEN 1 END) as newUsersMonth
        FROM users
      `).first(),

      // Family/Tenant statistics
      db.prepare(`
        SELECT
          COUNT(*) as totalFamilies,
          COUNT(CASE WHEN created_at > datetime('now', '-30 days') THEN 1 END) as newFamiliesMonth,
          ROUND(AVG(member_count), 1) as avgFamilySize
        FROM (
          SELECT t.id, t.created_at, COUNT(tu.user_id) as member_count
          FROM tenants t
          LEFT JOIN tenant_users tu ON t.id = tu.tenant_id
          GROUP BY t.id, t.created_at
        )
      `).first(),

      // Electricity consumption & purchase statistics
      db.prepare(`
        SELECT
          COUNT(CASE WHEN type = 'voucher' THEN 1 END) as totalVouchers,
          COUNT(CASE WHEN type = 'reading' THEN 1 END) as totalReadings,
          COALESCE(SUM(CASE WHEN type = 'voucher' THEN amount END), 0) as totalMoneySpent,
          COALESCE(SUM(CASE WHEN type = 'voucher' AND created_at > datetime('now', '-30 days') THEN amount END), 0) as moneySpentMonth,
          COUNT(CASE WHEN type = 'voucher' AND created_at > datetime('now', '-7 days') THEN 1 END) as vouchersWeek,
          COUNT(CASE WHEN type = 'reading' AND created_at > datetime('now', '-7 days') THEN 1 END) as readingsWeek
        FROM readings
      `).first(),

      // Financial insights
      db.prepare(`
        SELECT
          COALESCE(ROUND(AVG(CASE WHEN type = 'voucher' THEN amount END), 2), 0) as avgVoucherAmount,
          COALESCE(MAX(CASE WHEN type = 'voucher' THEN amount END), 0) as largestVoucher,
          COUNT(DISTINCT user_id) as activeUsers30d
        FROM readings
        WHERE type = 'voucher' AND created_at > datetime('now', '-30 days')
      `).first(),

      // Recent activity and engagement
      db.prepare(`
        SELECT
          COUNT(CASE WHEN created_at > datetime('now', '-1 day') THEN 1 END) as activity24h,
          COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as activity7d,
          COUNT(DISTINCT user_id) as activeUsersWeek
        FROM readings
        WHERE created_at > datetime('now', '-7 days')
      `).first()
    ]);

    return c.json({
      success: true,
      data: {
        totalUsers: userStats?.totalUsers || 0,
        totalFamilies: familyStats?.totalFamilies || 0,
        totalVouchers: electricityStats?.totalVouchers || 0,
        totalReadings: electricityStats?.totalReadings || 0,
        totalMoneySpent: electricityStats?.totalMoneySpent || 0,
        moneySpentMonth: electricityStats?.moneySpentMonth || 0,
        avgVoucherAmount: financialStats?.avgVoucherAmount || 0,
        largestVoucher: financialStats?.largestVoucher || 0,
        activeUsers30d: financialStats?.activeUsers30d || 0,
        activity24h: activityStats?.activity24h || 0,
        activity7d: activityStats?.activity7d || 0,
        activeUsersWeek: activityStats?.activeUsersWeek || 0,
        avgFamilySize: familyStats?.avgFamilySize || 0,
        newUsersWeek: userStats?.newUsersWeek || 0,
        newUsersMonth: userStats?.newUsersMonth || 0,
        vouchersWeek: electricityStats?.vouchersWeek || 0,
        readingsWeek: electricityStats?.readingsWeek || 0
      }
    });
  } catch (error) {
    console.error('System overview error:', error);
    return c.json({ error: 'Failed to fetch system overview' }, 500);
  }
});

// 2. USER MANAGEMENT
app.get('/api/admin/users', async (c) => {
  try {
    const db = c.env.DB;
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const search = c.req.query('search') || '';
    const offset = (page - 1) * limit;

    let searchFilter = '';
    let searchParams = [limit, offset];

    if (search) {
      searchFilter = 'WHERE u.email LIKE ?';
      searchParams = [`%${search}%`, limit, offset];
    }

    // Optimized query: Get users first, then join with aggregated counts
    const users = await db.prepare(`
      SELECT
        u.id,
        u.email,
        u.created_at,
        u.updated_at,
        t.name as tenant_name,
        tu.role,
        tu.joined_at,
        COALESCE(rc.voucher_count, 0) as voucher_count,
        COALESCE(rc.reading_count, 0) as reading_count
      FROM users u
      LEFT JOIN tenant_users tu ON u.id = tu.user_id
      LEFT JOIN tenants t ON tu.tenant_id = t.id
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(CASE WHEN type = 'voucher' THEN 1 END) as voucher_count,
          COUNT(CASE WHEN type = 'reading' THEN 1 END) as reading_count
        FROM readings
        GROUP BY user_id
      ) rc ON u.id = rc.user_id
      ${searchFilter}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...searchParams).all();

    const totalCount = await db.prepare(`
      SELECT COUNT(*) as count FROM users u ${searchFilter}
    `).bind(search ? `%${search}%` : null).first();

    return c.json({
      success: true,
      data: {
        users: users.results || [],
        pagination: {
          page,
          limit,
          total: totalCount.count,
          pages: Math.ceil(totalCount.count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Users list error:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// 2.1. LIGHTWEIGHT USER LIST (for dropdowns)
app.get('/api/admin/users/list', async (c) => {
  try {
    const db = c.env.DB;
    const limit = parseInt(c.req.query('limit') || '100');

    // Lightweight query for dropdowns - no expensive calculations
    const users = await db.prepare(`
      SELECT
        u.id,
        u.email,
        tu.role,
        t.name as tenant_name
      FROM users u
      LEFT JOIN tenant_users tu ON u.id = tu.user_id
      LEFT JOIN tenants t ON tu.tenant_id = t.id
      ORDER BY u.email ASC
      LIMIT ?
    `).bind(limit).all();

    return c.json({
      success: true,
      data: {
        users: users.results || []
      }
    });
  } catch (error) {
    console.error('User list error:', error);
    return c.json({ error: 'Failed to fetch user list' }, 500);
  }
});

// 3. USER DETAILS
app.get('/api/admin/users/:userId', async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'));
    const db = c.env.DB;

    const userDetails = await db.prepare(`
      SELECT
        u.id,
        u.email,
        u.created_at,
        u.updated_at,
        t.id as tenant_id,
        t.name as tenant_name,
        tu.role,
        tu.joined_at
      FROM users u
      LEFT JOIN tenant_users tu ON u.id = tu.user_id
      LEFT JOIN tenants t ON tu.tenant_id = t.id
      WHERE u.id = ?
    `).bind(userId).first();

    if (!userDetails) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get user's activity
    const [vouchers, readings] = await Promise.all([
      db.prepare(`
        SELECT * FROM readings WHERE user_id = ? AND type = 'voucher' ORDER BY created_at DESC LIMIT 10
      `).bind(userId).all(),

      db.prepare(`
        SELECT * FROM readings WHERE user_id = ? AND type = 'reading' ORDER BY created_at DESC LIMIT 10
      `).bind(userId).all()
    ]);

    return c.json({
      success: true,
      data: {
        user: userDetails,
        activity: {
          vouchers: vouchers.results || [],
          readings: readings.results || []
        }
      }
    });
  } catch (error) {
    console.error('User details error:', error);
    return c.json({ error: 'Failed to fetch user details' }, 500);
  }
});

// 4. ADMIN PASSWORD RESET
app.post('/api/admin/users/:userId/reset-password', async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'));
    const { newPassword } = await c.req.json();
    const db = c.env.DB;

    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters long' }, 400);
    }

    const user = await db.prepare(`
      SELECT email FROM users WHERE id = ?
    `).bind(userId).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await db.prepare(`
      UPDATE users
      SET password = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(hashedPassword, userId).run();

    // Send email notification to user
    try {
      const emailService = new CloudflareEmailService(c.env);
      await emailService.sendAdminPasswordResetNotification({
        recipientEmail: user.email,
        adminEmail: c.get('user')?.email || 'System Administrator'
      });
    } catch (emailError) {
      console.error('Failed to send password reset notification email:', emailError);
      // Don't fail the password reset if email fails
    }

    return c.json({
      success: true,
      message: `Password reset successfully for ${user.email}. Notification email sent.`
    });
  } catch (error) {
    console.error('Admin password reset error:', error);
    return c.json({ error: 'Failed to reset password' }, 500);
  }
});

// 5. TENANT MANAGEMENT
app.get('/api/admin/tenants', async (c) => {
  try {
    const db = c.env.DB;

    const tenants = await db.prepare(`
      SELECT
        t.id,
        t.name,
        t.created_at,
        COUNT(tu.user_id) as member_count,
        COALESCE(SUM(v.rand_amount), 0) as total_spent,
        COALESCE(SUM(v.kwh_amount), 0) as total_kwh,
        COUNT(v.id) as voucher_count,
        COUNT(r.id) as reading_count
      FROM tenants t
      LEFT JOIN tenant_users tu ON t.id = tu.tenant_id
      LEFT JOIN vouchers v ON t.id = v.tenant_id
      LEFT JOIN readings r ON t.id = r.tenant_id
      GROUP BY t.id, t.name, t.created_at
      ORDER BY t.created_at DESC
    `).all();

    return c.json({
      success: true,
      data: tenants.results || []
    });
  } catch (error) {
    console.error('Tenants list error:', error);
    return c.json({ error: 'Failed to fetch tenants' }, 500);
  }
});

// 6. SYSTEM MAINTENANCE
app.post('/api/admin/system/cleanup', async (c) => {
  try {
    const db = c.env.DB;
    const { action } = await c.req.json();

    let result = {};

    switch (action) {
      case 'expired_tokens':
        const tokenCleanup = await db.prepare(`
          DELETE FROM password_reset_tokens WHERE expires_at < datetime('now')
        `).run();
        result.message = `Cleaned up ${tokenCleanup.changes} expired password reset tokens`;
        break;

      case 'expired_invites':
        const inviteCleanup = await db.prepare(`
          UPDATE invite_codes SET is_active = 0 WHERE expires_at < datetime('now')
        `).run();
        result.message = `Deactivated ${inviteCleanup.changes} expired invite codes`;
        break;

      case 'orphaned_data':
        // Clean up vouchers/readings without valid users
        const orphanedVouchers = await db.prepare(`
          DELETE FROM vouchers WHERE user_id NOT IN (SELECT id FROM users)
        `).run();
        const orphanedReadings = await db.prepare(`
          DELETE FROM readings WHERE user_id NOT IN (SELECT id FROM users)
        `).run();
        result.message = `Cleaned up ${orphanedVouchers.changes} orphaned vouchers and ${orphanedReadings.changes} orphaned readings`;
        break;

      default:
        return c.json({ error: 'Invalid cleanup action' }, 400);
    }

    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('System cleanup error:', error);
    return c.json({ error: 'Failed to perform cleanup' }, 500);
  }
});

// 7. DATA EXPORT
app.get('/api/admin/export/:type', async (c) => {
  try {
    const type = c.req.param('type');
    const db = c.env.DB;

    let data = [];
    let filename = '';

    switch (type) {
      case 'users':
        const users = await db.prepare(`
          SELECT u.*, t.name as tenant_name, tu.role
          FROM users u
          LEFT JOIN tenant_users tu ON u.id = tu.user_id
          LEFT JOIN tenants t ON tu.tenant_id = t.id
          ORDER BY u.created_at DESC
        `).all();
        data = users.results || [];
        filename = `users-export-${Date.now()}.json`;
        break;

      case 'vouchers':
        const vouchers = await db.prepare(`
          SELECT v.*, u.email as user_email, t.name as tenant_name
          FROM vouchers v
          JOIN users u ON v.user_id = u.id
          JOIN tenants t ON v.tenant_id = t.id
          ORDER BY v.created_at DESC
        `).all();
        data = vouchers.results || [];
        filename = `vouchers-export-${Date.now()}.json`;
        break;

      case 'system':
        const systemData = await db.prepare(`
          SELECT
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(*) FROM tenants) as total_tenants,
            (SELECT COUNT(*) FROM vouchers) as total_vouchers,
            (SELECT COUNT(*) FROM readings) as total_readings,
            (SELECT COALESCE(SUM(rand_amount), 0) FROM vouchers) as total_money,
            datetime('now') as export_timestamp
        `).first();
        data = [systemData];
        filename = `system-export-${Date.now()}.json`;
        break;

      default:
        return c.json({ error: 'Invalid export type' }, 400);
    }

    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);

    return c.json({
      exportType: type,
      timestamp: new Date().toISOString(),
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('Data export error:', error);
    return c.json({ error: 'Failed to export data' }, 500);
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
app.get('/forgot-password', serveStatic({ path: './public/forgot-password.html' }));
app.get('/reset-password', serveStatic({ path: './public/reset-password.html' }));
app.get('/register', serveStatic({ path: './public/register.html' }));
app.get('/dashboard', serveStatic({ path: './public/dashboard.html' }));
app.get('/voucher', serveStatic({ path: './public/voucher.html' }));
app.get('/reading', serveStatic({ path: './public/reading.html' }));
app.get('/history', serveStatic({ path: './public/history.html' }));
app.get('/settings', serveStatic({ path: './public/settings.html' }));
app.get('/admin', serveStatic({ path: './public/admin.html' }));
app.get('/invite', serveStatic({ path: './public/invite.html' }));

export default app;
