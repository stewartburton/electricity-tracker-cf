// Email Service for sending invitations via Gmail API
// This service handles template rendering and email delivery in Cloudflare Workers

class EmailService {
  constructor(env) {
    this.env = env;
    this.baseUrl = env.BASE_URL || 'https://powermeter.app';
    this.fromEmail = 'stewart.burton84@gmail.com';
    this.fromName = 'PowerMeter';
  }

  // Template rendering with simple variable substitution
  renderTemplate(template, variables) {
    let rendered = template;

    // Handle if/endif blocks
    rendered = rendered.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      return variables[condition] ? content : '';
    });

    // Handle variable substitutions
    rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return variables[variable] || '';
    });

    return rendered;
  }

  // Email templates (embedded since we can't read files in Workers)
  getTemplate(templateName, format = 'html') {
    const templates = {
      'family-invitation.html': `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're invited to join {{senderName}}'s PowerMeter family account</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #c27d18 0%, #a16d13 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { font-size: 32px; margin-bottom: 8px; font-weight: 700; }
        .header p { font-size: 16px; opacity: 0.9; }
        .content { padding: 40px 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; }
        .content h2 { color: #111827; margin-bottom: 20px; font-size: 24px; }
        .content p { margin-bottom: 16px; color: #374151; }
        .features { margin: 24px 0; padding: 0; list-style: none; }
        .features li { padding: 8px 0; color: #374151; font-size: 15px; }
        .invite-code { background: #f3f4f6; border: 2px solid #c27d18; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
        .invite-code-label { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
        .invite-code-value { font-size: 24px; font-weight: 700; color: #c27d18; font-family: 'Courier New', monospace; letter-spacing: 2px; }
        .button { background: #c27d18; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .info-box { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 24px 0; border-radius: 0 8px 8px 0; }
        .info-box h3 { color: #0369a1; margin-bottom: 8px; }
        .info-box p { color: #0c4a6e; margin-bottom: 0; }
        .footer { background: #f9fafb; padding: 30px; font-size: 14px; color: #6b7280; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
        .footer a { color: #c27d18; text-decoration: none; }
        .footer p { margin-bottom: 8px; }
        @media only screen and (max-width: 600px) {
            .container { margin: 10px; }
            .header, .content, .footer { padding: 20px; }
            .header h1 { font-size: 24px; }
            .content h2 { font-size: 20px; }
            .invite-code-value { font-size: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ PowerMeter</h1>
            <p>Smart Electricity Tracking</p>
        </div>
        <div class="content">
            <h2>You're invited to join {{senderName}}'s family account!</h2>
            <p>Hi there!</p>
            <p><strong>{{senderName}}</strong> ({{senderEmail}}) has invited you to join their PowerMeter family account. This means you'll be able to:</p>
            <ul class="features">
                <li>📊 View shared electricity usage data</li>
                <li>⚡ Add voucher purchases and meter readings</li>
                <li>📈 See family consumption trends and analytics</li>
                <li>💰 Track household electricity spending together</li>
            </ul>
            <div class="invite-code">
                <div class="invite-code-label">Your invitation code:</div>
                <div class="invite-code-value">{{inviteCode}}</div>
            </div>
            <div style="text-align: center;">
                <a href="{{registrationUrl}}" class="button">Join {{senderName}}'s Family Account</a>
            </div>
            <p style="text-align: center; font-size: 14px; color: #6b7280;">
                Or copy this link: <br>
                <a href="{{registrationUrl}}" style="color: #c27d18; word-break: break-all;">{{registrationUrl}}</a>
            </p>
            {{#if personalMessage}}
            <div class="info-box">
                <h3>Personal message from {{senderName}}:</h3>
                <p>"{{personalMessage}}"</p>
            </div>
            {{/if}}
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
            <div class="info-box">
                <h3>What is PowerMeter?</h3>
                <p>PowerMeter is a family-friendly electricity tracking platform that helps South African households monitor their prepaid electricity usage, track spending patterns, and manage consumption together.</p>
            </div>
            <p style="font-size: 14px; color: #6b7280; text-align: center;">
                This invitation expires on {{expiryDate}}.
            </p>
        </div>
        <div class="footer">
            <p>Sent by <strong>{{senderName}}</strong> via PowerMeter</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> • <a href="https://powermeter.app">PowerMeter.app</a></p>
            <p>PowerMeter - Smart Electricity Tracking for South African Families</p>
        </div>
    </div>
    <img src="{{trackingPixelUrl}}" width="1" height="1" style="display:none;" alt="">
</body>
</html>`,

      'family-invitation.txt': `⚡ PowerMeter - You're invited to join {{senderName}}'s family account!

Hi there!

{{senderName}} ({{senderEmail}}) has invited you to join their PowerMeter family account for tracking electricity usage together.

Your invitation code: {{inviteCode}}

Join their family account here: {{registrationUrl}}

What you'll be able to do:
• View shared electricity usage data
• Add voucher purchases and meter readings
• See family consumption trends and analytics
• Track household electricity spending together

{{#if personalMessage}}
Personal message from {{senderName}}: "{{personalMessage}}"
{{/if}}

What is PowerMeter?
PowerMeter is a family-friendly electricity tracking platform that helps South African households monitor their prepaid electricity usage, track spending patterns, and manage consumption together.

This invitation expires on {{expiryDate}}.

---
Sent by {{senderName}} via PowerMeter
PowerMeter.app - Smart Electricity Tracking for South African Families
Unsubscribe: {{unsubscribeUrl}}`,

      'new-account-invitation.html': `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{senderName}} recommends PowerMeter for electricity tracking</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #c27d18 0%, #a16d13 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { font-size: 32px; margin-bottom: 8px; font-weight: 700; }
        .header p { font-size: 16px; opacity: 0.9; }
        .content { padding: 40px 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; }
        .content h2 { color: #111827; margin-bottom: 20px; font-size: 24px; }
        .content p { margin-bottom: 16px; color: #374151; }
        .features { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
        .feature { padding: 20px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #c27d18; }
        .feature h4 { color: #111827; margin-bottom: 8px; font-size: 16px; }
        .feature p { color: #6b7280; font-size: 14px; margin-bottom: 0; }
        .button { background: #c27d18; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .benefits { margin: 24px 0; padding: 0; list-style: none; }
        .benefits li { padding: 8px 0; color: #374151; font-size: 15px; }
        .testimonial { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 24px 0; border-radius: 0 8px 8px 0; font-style: italic; }
        .testimonial p { color: #0c4a6e; margin-bottom: 8px; }
        .testimonial .author { font-weight: 600; font-style: normal; color: #0369a1; }
        .stats { background: #fefce8; border: 1px solid #facc15; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center; }
        .stats p { color: #713f12; margin-bottom: 0; font-weight: 600; }
        .footer { background: #f9fafb; padding: 30px; font-size: 14px; color: #6b7280; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
        .footer a { color: #c27d18; text-decoration: none; }
        .footer p { margin-bottom: 8px; }
        @media only screen and (max-width: 600px) {
            .container { margin: 10px; }
            .header, .content, .footer { padding: 20px; }
            .header h1 { font-size: 24px; }
            .content h2 { font-size: 20px; }
            .features { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ PowerMeter</h1>
            <p>Smart Electricity Tracking</p>
        </div>
        <div class="content">
            <h2>{{senderName}} thinks you'd love PowerMeter!</h2>
            <p>Hi there!</p>
            <p><strong>{{senderName}}</strong> thinks you'd benefit from PowerMeter - South Africa's leading electricity usage tracking platform.</p>
            {{#if personalMessage}}
            <div class="testimonial">
                <p>"{{personalMessage}}"</p>
                <div class="author">— {{senderName}}</div>
            </div>
            {{/if}}
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
            <div style="text-align: center;">
                <a href="{{registrationUrl}}" class="button">Start Tracking Your Electricity Usage</a>
            </div>
            <p style="text-align: center; font-size: 14px; color: #6b7280;">
                Free to get started • No credit card required
            </p>
            <div class="stats">
                <p>Join thousands of South African families already saving on electricity with PowerMeter</p>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
            <h3 style="color: #111827; margin-bottom: 16px;">Why PowerMeter?</h3>
            <ul class="benefits">
                <li>🇿🇦 Built specifically for South African prepaid electricity</li>
                <li>⚡ Track voucher purchases and meter readings effortlessly</li>
                <li>📊 Understand your consumption patterns with detailed analytics</li>
                <li>💰 Optimize your electricity spending and reduce waste</li>
                <li>👨‍👩‍👧‍👦 Manage family usage together with shared accounts</li>
                <li>📱 Import vouchers directly from FNB SMS messages</li>
            </ul>
            <p>Start your journey to smarter electricity management today!</p>
        </div>
        <div class="footer">
            <p>Recommended by <strong>{{senderName}}</strong> via PowerMeter</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> • <a href="https://powermeter.app">PowerMeter.app</a></p>
            <p>PowerMeter - Smart Electricity Tracking for South African Families</p>
        </div>
    </div>
    <img src="{{trackingPixelUrl}}" width="1" height="1" style="display:none;" alt="">
</body>
</html>`,

      'new-account-invitation.txt': `⚡ PowerMeter - {{senderName}} thinks you'd love this electricity tracking app!

Hi there!

{{senderName}} thinks you'd benefit from PowerMeter - South Africa's leading electricity usage tracking platform.

{{#if personalMessage}}
Personal message from {{senderName}}: "{{personalMessage}}"
{{/if}}

Key features:
📊 Smart Analytics - Track consumption trends and spending patterns
📱 SMS Integration - Import vouchers directly from FNB SMS
👨‍👩‍👧‍👦 Family Accounts - Share tracking with household members
📈 Monthly Reports - Detailed consumption and cost analysis

Start tracking your electricity usage: {{registrationUrl}}

Free to get started • No credit card required

Why PowerMeter?
🇿🇦 Built specifically for South African prepaid electricity
⚡ Track voucher purchases and meter readings effortlessly
📊 Understand your consumption patterns with detailed analytics
💰 Optimize your electricity spending and reduce waste
👨‍👩‍👧‍👦 Manage family usage together with shared accounts
📱 Import vouchers directly from FNB SMS messages

Join thousands of South African families already saving on electricity with PowerMeter.

---
Recommended by {{senderName}} via PowerMeter
PowerMeter.app - Smart Electricity Tracking for South African Families
Unsubscribe: {{unsubscribeUrl}}`
    };

    return templates[`${templateName}.${format}`] || null;
  }

  // Generate tracking URLs
  generateTrackingUrls(emailInvitationId) {
    return {
      trackingPixelUrl: `${this.baseUrl}/api/invitations/track/open/${emailInvitationId}`,
      clickTrackingUrl: `${this.baseUrl}/api/invitations/track/click/${emailInvitationId}`,
      unsubscribeUrl: `${this.baseUrl}/api/invitations/unsubscribe/${emailInvitationId}`
    };
  }

  // Create MIME message for Gmail API
  createMimeMessage(to, subject, htmlBody, textBody) {
    const boundary = Math.random().toString(36).substring(2);

    const mimeMessage = [
      `From: ${this.fromName} <${this.fromEmail}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      textBody,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody,
      '',
      `--${boundary}--`
    ].join('\r\n');

    // Base64 encode for Gmail API
    return btoa(mimeMessage).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // Send email via Gmail API
  async sendEmail(to, subject, htmlBody, textBody) {
    try {
      const accessToken = await this.getGmailAccessToken();
      const encodedMessage = this.createMimeMessage(to, subject, htmlBody, textBody);

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodedMessage
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gmail API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      return {
        success: true,
        messageId: result.id,
        threadId: result.threadId
      };
    } catch (error) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get Gmail access token (OAuth2)
  async getGmailAccessToken() {
    // For production, you'll need to implement OAuth2 flow
    // For now, return the stored access token from environment
    if (!this.env.GMAIL_ACCESS_TOKEN) {
      throw new Error('Gmail access token not configured');
    }

    // Check if token needs refresh
    if (this.env.GMAIL_REFRESH_TOKEN) {
      return await this.refreshGmailToken();
    }

    return this.env.GMAIL_ACCESS_TOKEN;
  }

  // Refresh Gmail access token
  async refreshGmailToken() {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.env.GMAIL_CLIENT_ID,
          client_secret: this.env.GMAIL_CLIENT_SECRET,
          refresh_token: this.env.GMAIL_REFRESH_TOKEN,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokens = await response.json();
      return tokens.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  // Send family invitation email
  async sendFamilyInvitation(invitationData) {
    const {
      recipientEmail,
      senderName,
      senderEmail,
      inviteCode,
      tenantName,
      personalMessage,
      emailInvitationId
    } = invitationData;

    const trackingUrls = this.generateTrackingUrls(emailInvitationId);
    const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();

    const templateVariables = {
      senderName,
      senderEmail,
      inviteCode,
      tenantName,
      personalMessage,
      expiryDate,
      registrationUrl: `${this.baseUrl}/register?invite=${inviteCode}`,
      trackingPixelUrl: trackingUrls.trackingPixelUrl,
      unsubscribeUrl: trackingUrls.unsubscribeUrl
    };

    const htmlTemplate = this.getTemplate('family-invitation', 'html');
    const textTemplate = this.getTemplate('family-invitation', 'txt');

    if (!htmlTemplate || !textTemplate) {
      throw new Error('Email templates not found');
    }

    const htmlBody = this.renderTemplate(htmlTemplate, templateVariables);
    const textBody = this.renderTemplate(textTemplate, templateVariables);
    const subject = `You're invited to join ${senderName}'s PowerMeter family account`;

    const result = await this.sendEmail(recipientEmail, subject, htmlBody, textBody);

    return {
      ...result,
      subject,
      htmlBody,
      textBody
    };
  }

  // Send new account invitation email
  async sendNewAccountInvitation(invitationData) {
    const {
      recipientEmail,
      senderName,
      referralCode,
      personalMessage,
      emailInvitationId
    } = invitationData;

    const trackingUrls = this.generateTrackingUrls(emailInvitationId);

    const templateVariables = {
      senderName,
      personalMessage,
      referralCode,
      registrationUrl: `${this.baseUrl}/register?ref=${referralCode}`,
      trackingPixelUrl: trackingUrls.trackingPixelUrl,
      unsubscribeUrl: trackingUrls.unsubscribeUrl
    };

    const htmlTemplate = this.getTemplate('new-account-invitation', 'html');
    const textTemplate = this.getTemplate('new-account-invitation', 'txt');

    if (!htmlTemplate || !textTemplate) {
      throw new Error('Email templates not found');
    }

    const htmlBody = this.renderTemplate(htmlTemplate, templateVariables);
    const textBody = this.renderTemplate(textTemplate, templateVariables);
    const subject = `${senderName} recommends PowerMeter for electricity tracking`;

    const result = await this.sendEmail(recipientEmail, subject, htmlBody, textBody);

    return {
      ...result,
      subject,
      htmlBody,
      textBody
    };
  }
}

export default EmailService;