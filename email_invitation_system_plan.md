# Email Invitation System Implementation Plan

## 🎯 Overview

Design and implement a comprehensive email invitation system for the PowerMeter multi-tenant electricity tracker. This system will allow users to invite others via email with two distinct invitation types:

1. **Family/Household Invitations** - Invite users to join existing tenant (shared data)
2. **New Account Invitations** - Invite users to create their own separate tenant

## 📧 Email Types & Use Cases

### Type 1: Family/Household Invitation
**Scenario**: Existing user wants to invite family member to join their household account
- **Sender**: Admin user of existing tenant
- **Recipient**: New user who will join existing tenant
- **Data Sharing**: Full access to existing household data
- **Technical Flow**: Uses existing invite_codes system + email delivery

### Type 2: New Account Invitation
**Scenario**: User wants to invite friend/colleague to try PowerMeter with their own account
- **Sender**: Any existing user (referral system)
- **Recipient**: New user who will create separate tenant
- **Data Sharing**: No shared data - completely separate account
- **Technical Flow**: New invitation system + optional referral tracking

## 🏗️ Technical Architecture

### Email Sending Infrastructure Options

#### Option A: Gmail API (Recommended)
**Pros:**
- Uses your existing Gmail account (stewart.burton84@gmail.com)
- Professional "sent from" address
- Gmail's excellent deliverability
- Free for reasonable volumes
- Rich API with delivery tracking

**Cons:**
- Requires OAuth2 setup
- Daily sending limits (500 emails/day for free Gmail)
- More complex authentication

**Implementation:**
```javascript
// Using Gmail API in Cloudflare Workers
const sendEmail = async (to, subject, htmlBody, textBody) => {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${gmailAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: createMimeMessage(to, subject, htmlBody, textBody)
    })
  });
};
```

#### Option B: Cloudflare Email Workers
**Pros:**
- Native Cloudflare integration
- Serverless email sending
- Good performance
- Simple setup

**Cons:**
- Newer service, less mature
- May require paid plan
- Custom domain required

#### Option C: SMTP via Gmail
**Pros:**
- Simple SMTP implementation
- Uses Gmail infrastructure
- Good deliverability

**Cons:**
- Requires app passwords
- Less secure than OAuth2
- Limited tracking capabilities

## 📊 Database Schema Changes

### New Table: email_invitations
```sql
CREATE TABLE email_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    sent_by_user_id INTEGER NOT NULL,
    invitation_type TEXT NOT NULL, -- 'family' or 'new_account'
    recipient_email TEXT NOT NULL,
    invite_code TEXT, -- Links to invite_codes table for family invitations
    referral_code TEXT, -- Unique code for new account invitations
    email_subject TEXT NOT NULL,
    email_body_html TEXT NOT NULL,
    email_body_text TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'opened', 'clicked', 'registered'
    opened_at DATETIME,
    clicked_at DATETIME,
    registered_at DATETIME,
    registered_user_id INTEGER,
    expires_at DATETIME,
    metadata JSON, -- Store tracking data, email provider response, etc.
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (sent_by_user_id) REFERENCES users(id),
    FOREIGN KEY (invite_code) REFERENCES invite_codes(code),
    FOREIGN KEY (registered_user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_email_invitations_tenant_id ON email_invitations(tenant_id);
CREATE INDEX idx_email_invitations_recipient_email ON email_invitations(recipient_email);
CREATE INDEX idx_email_invitations_referral_code ON email_invitations(referral_code);
CREATE INDEX idx_email_invitations_status ON email_invitations(status);
```

### Extend invite_codes table
```sql
-- Add email tracking to existing invite_codes
ALTER TABLE invite_codes ADD COLUMN email_invitation_id INTEGER;
ALTER TABLE invite_codes ADD COLUMN sent_via_email BOOLEAN DEFAULT 0;
```

## 📧 Email Templates

### Family/Household Invitation Template

#### HTML Template
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're invited to join {{senderName}}'s PowerMeter family account</title>
    <style>
        /* Responsive email styles */
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background: linear-gradient(135deg, #c27d18 0%, #a16d13 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #ffffff; }
        .button { background: #c27d18; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ PowerMeter</h1>
            <p>Electricity Usage Tracking</p>
        </div>

        <div class="content">
            <h2>You're invited to join {{senderName}}'s family account!</h2>

            <p>Hi there!</p>

            <p>{{senderName}} ({{senderEmail}}) has invited you to join their PowerMeter family account. This means you'll be able to:</p>

            <ul>
                <li>📊 View shared electricity usage data</li>
                <li>⚡ Add voucher purchases and meter readings</li>
                <li>📈 See family consumption trends and analytics</li>
                <li>💰 Track household electricity spending together</li>
            </ul>

            <p>Your invitation code is: <strong>{{inviteCode}}</strong></p>

            <a href="{{registrationUrl}}" class="button">Join {{senderName}}'s Family Account</a>

            <p><small>Or copy this link: {{registrationUrl}}</small></p>

            <hr>

            <h3>What is PowerMeter?</h3>
            <p>PowerMeter is a family-friendly electricity tracking platform that helps households monitor their prepaid electricity usage, track spending patterns, and manage consumption together.</p>

            <p>This invitation expires on {{expiryDate}}.</p>
        </div>

        <div class="footer">
            <p>Sent by {{senderName}} via PowerMeter • <a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
            <p>PowerMeter - Smart Electricity Tracking for South African Families</p>
        </div>
    </div>

    <!-- Tracking pixel -->
    <img src="{{trackingPixelUrl}}" width="1" height="1" style="display:none;" alt="">
</body>
</html>
```

#### Text Template
```text
⚡ PowerMeter - You're invited to join {{senderName}}'s family account!

Hi there!

{{senderName}} ({{senderEmail}}) has invited you to join their PowerMeter family account for tracking electricity usage together.

Your invitation code: {{inviteCode}}

Join their family account here: {{registrationUrl}}

What you'll be able to do:
• View shared electricity usage data
• Add voucher purchases and meter readings
• See family consumption trends and analytics
• Track household electricity spending together

What is PowerMeter?
PowerMeter is a family-friendly electricity tracking platform that helps households monitor their prepaid electricity usage, track spending patterns, and manage consumption together.

This invitation expires on {{expiryDate}}.

---
Sent by {{senderName}} via PowerMeter
PowerMeter - Smart Electricity Tracking for South African Families
Unsubscribe: {{unsubscribeUrl}}
```

### New Account Invitation Template

#### HTML Template
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{senderName}} recommends PowerMeter for electricity tracking</title>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background: linear-gradient(135deg, #c27d18 0%, #a16d13 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #ffffff; }
        .button { background: #c27d18; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; }
        .features { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .feature { padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .footer { background: #f8f9fa; padding: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ PowerMeter</h1>
            <p>Smart Electricity Tracking</p>
        </div>

        <div class="content">
            <h2>{{senderName}} recommends PowerMeter for you!</h2>

            <p>Hi there!</p>

            <p>{{senderName}} thinks you'd benefit from PowerMeter - South Africa's leading electricity usage tracking platform.</p>

            <div class="features">
                <div class="feature">
                    <h4>📊 Smart Analytics</h4>
                    <p>Track consumption trends and spending patterns</p>
                </div>
                <div class="feature">
                    <h4>📱 SMS Integration</h4>
                    <p>Import vouchers directly from FNB SMS</p>
                </div>
                <div class="feature">
                    <h4>👨‍👩‍👧‍👦 Family Accounts</h4>
                    <p>Share tracking with household members</p>
                </div>
                <div class="feature">
                    <h4>📈 Monthly Reports</h4>
                    <p>Detailed consumption and cost analysis</p>
                </div>
            </div>

            <a href="{{registrationUrl}}" class="button">Start Tracking Your Electricity Usage</a>

            <p><small>Free to get started • No credit card required</small></p>

            <hr>

            <h3>Why PowerMeter?</h3>
            <ul>
                <li>🇿🇦 Built specifically for South African prepaid electricity</li>
                <li>⚡ Track voucher purchases and meter readings</li>
                <li>📊 Understand your consumption patterns</li>
                <li>💰 Optimize your electricity spending</li>
                <li>👨‍👩‍👧‍👦 Manage family usage together</li>
            </ul>

            <p>Join thousands of South African families already saving on electricity with PowerMeter.</p>
        </div>

        <div class="footer">
            <p>Recommended by {{senderName}} • <a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
            <p>PowerMeter - Smart Electricity Tracking for South African Families</p>
        </div>
    </div>

    <!-- Tracking pixel -->
    <img src="{{trackingPixelUrl}}" width="1" height="1" style="display:none;" alt="">
</body>
</html>
```

## 🔧 API Endpoints

### Send Family/Household Invitation
```javascript
// POST /api/invitations/family
app.post('/api/invitations/family', authMiddleware, tenantMiddleware, async (c) => {
  const { email, message } = await c.req.json();
  const user = c.get('user');
  const tenant = c.get('tenant');

  // Validate admin role
  if (tenant.role !== 'admin') {
    return c.json({ error: 'Admin role required' }, 403);
  }

  // Generate invite code
  const inviteCode = crypto.randomBytes(8).toString('hex').toUpperCase();

  // Create invite code record
  const inviteResult = await c.env.DB.prepare(`
    INSERT INTO invite_codes (tenant_id, code, created_by, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(
    tenant.id,
    inviteCode,
    user.userId,
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  ).run();

  // Send email
  const emailResult = await sendFamilyInvitationEmail({
    recipientEmail: email,
    senderName: user.name || user.email,
    senderEmail: user.email,
    inviteCode,
    tenantName: tenant.name,
    message
  });

  // Record email invitation
  await c.env.DB.prepare(`
    INSERT INTO email_invitations (
      tenant_id, sent_by_user_id, invitation_type, recipient_email,
      invite_code, email_subject, email_body_html, email_body_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenant.id, user.userId, 'family', email,
    inviteCode, emailResult.subject, emailResult.htmlBody, emailResult.textBody
  ).run();

  return c.json({
    message: 'Family invitation sent successfully',
    inviteCode,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
});
```

### Send New Account Invitation
```javascript
// POST /api/invitations/new-account
app.post('/api/invitations/new-account', authMiddleware, tenantMiddleware, async (c) => {
  const { email, message } = await c.req.json();
  const user = c.get('user');

  // Generate referral code
  const referralCode = `REF_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

  // Send email
  const emailResult = await sendNewAccountInvitationEmail({
    recipientEmail: email,
    senderName: user.name || user.email,
    referralCode,
    message
  });

  // Record email invitation
  await c.env.DB.prepare(`
    INSERT INTO email_invitations (
      tenant_id, sent_by_user_id, invitation_type, recipient_email,
      referral_code, email_subject, email_body_html, email_body_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    user.tenantId, user.userId, 'new_account', email,
    referralCode, emailResult.subject, emailResult.htmlBody, emailResult.textBody
  ).run();

  return c.json({
    message: 'New account invitation sent successfully',
    referralCode
  });
});
```

### Email Tracking Endpoints
```javascript
// GET /api/invitations/track/open/:emailId
app.get('/api/invitations/track/open/:emailId', async (c) => {
  const emailId = c.req.param('emailId');

  // Update opened status
  await c.env.DB.prepare(`
    UPDATE email_invitations
    SET status = 'opened', opened_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'sent'
  `).bind(emailId).run();

  // Return tracking pixel
  return new Response(trackingPixelData, {
    headers: { 'Content-Type': 'image/png' }
  });
});

// GET /api/invitations/track/click/:emailId
app.get('/api/invitations/track/click/:emailId', async (c) => {
  const emailId = c.req.param('emailId');

  // Update clicked status
  await c.env.DB.prepare(`
    UPDATE email_invitations
    SET status = 'clicked', clicked_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(emailId).run();

  // Redirect to registration
  return c.redirect('/register');
});
```

## 🎨 UI Components

### Family Account Invitations (Settings Page)
```html
<div class="invitation-section">
  <h3>🏠 Invite Family Members</h3>
  <p>Add family members to your household account to track electricity usage together.</p>

  <form id="family-invitation-form">
    <div class="form-group">
      <label for="family-email">Email Address</label>
      <input type="email" id="family-email" required>
    </div>

    <div class="form-group">
      <label for="family-message">Personal Message (Optional)</label>
      <textarea id="family-message" placeholder="Add a personal note to your invitation..."></textarea>
    </div>

    <button type="submit" class="btn btn-primary">Send Family Invitation</button>
  </form>

  <div class="sent-invitations">
    <h4>Pending Family Invitations</h4>
    <div id="family-invitations-list">
      <!-- Populated via JavaScript -->
    </div>
  </div>
</div>
```

### New Account Invitations (Dashboard/Settings)
```html
<div class="referral-section">
  <h3>📧 Invite Friends to PowerMeter</h3>
  <p>Help friends start tracking their electricity usage with their own PowerMeter account.</p>

  <form id="referral-invitation-form">
    <div class="form-group">
      <label for="referral-email">Friend's Email Address</label>
      <input type="email" id="referral-email" required>
    </div>

    <div class="form-group">
      <label for="referral-message">Why should they try PowerMeter? (Optional)</label>
      <textarea id="referral-message" placeholder="Tell them why you love PowerMeter..."></textarea>
    </div>

    <button type="submit" class="btn btn-secondary">Send Invitation</button>
  </form>
</div>
```

## 🔐 Security Considerations

### Email Security
- **Rate Limiting**: Prevent spam by limiting invitations per user/tenant
- **Email Validation**: Verify email format and domain
- **Unsubscribe Links**: Include unsubscribe functionality
- **Tracking Security**: Secure tracking URLs with signed tokens

### Authentication Security
- **OAuth2 for Gmail**: Use secure OAuth2 flow for Gmail API
- **Token Storage**: Store Gmail tokens securely in environment variables
- **Token Refresh**: Implement automatic token refresh

### Invitation Security
- **Expiry**: All invitations expire after set time
- **Single Use**: Family invitations should be single-use
- **Validation**: Validate invitation codes and referral codes

## 📋 Implementation Steps

### Phase 1: Database & Infrastructure
1. **Create database migration** for email_invitations table
2. **Set up Gmail API** OAuth2 authentication
3. **Create email sending service** with Gmail API integration
4. **Add environment variables** for Gmail credentials

### Phase 2: Email Templates
1. **Design responsive HTML templates** for both invitation types
2. **Create text-only fallback templates**
3. **Implement template rendering** with variable substitution
4. **Add tracking pixels and click tracking**

### Phase 3: API Development
1. **Build family invitation endpoint** with invite code generation
2. **Build new account invitation endpoint** with referral tracking
3. **Add email tracking endpoints** for open/click tracking
4. **Implement invitation management** (list, resend, cancel)

### Phase 4: UI Integration
1. **Add family invitation form** to settings page
2. **Add referral invitation form** to dashboard
3. **Create invitation management interface**
4. **Add invitation status tracking**

### Phase 5: Testing & Optimization
1. **Test email delivery** across different providers
2. **Test mobile email rendering**
3. **Add analytics and reporting**
4. **Implement rate limiting and abuse prevention**

## 📊 Success Metrics

### Email Performance
- **Delivery Rate**: % of emails successfully delivered
- **Open Rate**: % of emails opened by recipients
- **Click Rate**: % of recipients who clicked invitation links
- **Conversion Rate**: % of invitations that resulted in registrations

### User Adoption
- **Family Account Growth**: New users joining existing tenants
- **Referral Signups**: New tenants created via referrals
- **Active Family Accounts**: Tenants with multiple active users
- **Retention**: User retention after joining via invitation

## 🚀 Future Enhancements

### Advanced Features
- **Email Templates Customization**: Allow users to customize invitation messages
- **Bulk Invitations**: Send multiple invitations at once
- **Social Sharing**: Share invitation links via WhatsApp, SMS, etc.
- **Invitation Analytics**: Detailed analytics dashboard for admins

### Integration Opportunities
- **Calendar Integration**: Send reminders about electricity usage
- **WhatsApp Business API**: Send invitations via WhatsApp
- **SMS Integration**: Send invitation codes via SMS
- **Social Login**: Allow invitation recipients to sign up with Google/Facebook

---

## 🎯 Next Actions

1. **Review this plan** and confirm the approach
2. **Set up Gmail API credentials** for your account
3. **Create database migration** for email_invitations table
4. **Implement basic email sending** with Gmail API
5. **Create and test first email template**
6. **Build family invitation endpoint**
7. **Add UI for sending family invitations**
8. **Test end-to-end invitation flow**

This comprehensive email invitation system will significantly enhance user acquisition and family account adoption for PowerMeter! 🚀