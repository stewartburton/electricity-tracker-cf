// Cloudflare Email Service - Simple email sending without OAuth
// Uses Cloudflare's built-in email capabilities

class CloudflareEmailService {
  constructor(env) {
    this.env = env;
    this.baseUrl = env.BASE_URL || 'https://powermeter.app';
    this.fromEmail = env.FROM_EMAIL || 'noreply@send.powermeter.app';
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

  // Simple HTML email templates
  getTemplate(templateName, format = 'html') {
    const templates = {
      'family-invitation.html': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're invited to join {{senderName}}'s PowerMeter family account</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 30px; border-radius: 10px; }
        .header { background: #c27d18; color: white; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
        .content { background: white; padding: 30px; border-radius: 8px; }
        .invite-code { background: #f0f8ff; border: 2px solid #c27d18; padding: 15px; text-align: center; margin: 20px 0; border-radius: 5px; }
        .button { background: #c27d18; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ PowerMeter</h1>
            <p>You're invited to join {{senderName}}'s family account!</p>
        </div>

        <div class="content">
            <h2>Hi there!</h2>
            <p>{{senderName}} ({{senderEmail}}) has invited you to join their PowerMeter family account for tracking electricity usage together.</p>

            <div class="invite-code">
                <strong>Your invitation code: {{inviteCode}}</strong>
            </div>

            {{#if personalMessage}}
            <p><strong>Personal message from {{senderName}}:</strong><br>"{{personalMessage}}"</p>
            {{/if}}

            <p>What you'll be able to do:</p>
            <ul>
                <li>View shared electricity usage data</li>
                <li>Add voucher purchases and meter readings</li>
                <li>See family consumption trends and analytics</li>
                <li>Track household electricity spending together</li>
            </ul>

            <div style="text-align: center;">
                <a href="{{registrationUrl}}" class="button">Join Family Account</a>
            </div>

            <p><strong>What is PowerMeter?</strong><br>
            PowerMeter is a family-friendly electricity tracking platform that helps South African households monitor their prepaid electricity usage, track spending patterns, and manage consumption together.</p>
        </div>

        <div class="footer">
            <p>Sent by {{senderName}} via PowerMeter</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> • PowerMeter.app</p>
        </div>
    </div>
</body>
</html>`,

      'new-account-invitation.html': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{senderName}} recommends PowerMeter for electricity tracking</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 30px; border-radius: 10px; }
        .header { background: #c27d18; color: white; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
        .content { background: white; padding: 30px; border-radius: 8px; }
        .features { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .feature { background: #f8f8f8; padding: 15px; border-radius: 5px; border-left: 4px solid #c27d18; }
        .button { background: #c27d18; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ PowerMeter</h1>
            <p>{{senderName}} thinks you'd love this electricity tracking app!</p>
        </div>

        <div class="content">
            <h2>Hi there!</h2>
            <p><strong>{{senderName}}</strong> thinks you'd benefit from PowerMeter - South Africa's leading electricity usage tracking platform.</p>

            {{#if personalMessage}}
            <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0; font-style: italic;">
                <p>"{{personalMessage}}"</p>
                <p><strong>— {{senderName}}</strong></p>
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

            <p style="text-align: center; color: #666;">Free to get started • No credit card required</p>

            <h3>Why PowerMeter?</h3>
            <ul>
                <li>🇿🇦 Built specifically for South African prepaid electricity</li>
                <li>⚡ Track voucher purchases and meter readings effortlessly</li>
                <li>📊 Understand your consumption patterns with detailed analytics</li>
                <li>💰 Optimize your electricity spending and reduce waste</li>
                <li>👨‍👩‍👧‍👦 Manage family usage together with shared accounts</li>
                <li>📱 Import vouchers directly from FNB SMS messages</li>
            </ul>
        </div>

        <div class="footer">
            <p>Recommended by <strong>{{senderName}}</strong> via PowerMeter</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> • PowerMeter.app</p>
        </div>
    </div>
</body>
</html>`,

      'password-reset.html': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset your {{productName}} password</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 24px; background: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(148, 163, 184, 0.2); }
        .header { background: linear-gradient(135deg, #c27d18 0%, #a16207 100%); color: #ffffff; padding: 32px 28px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 8px 0 0; font-size: 16px; opacity: 0.9; }
        .content { padding: 32px 28px; }
        .content h2 { margin-top: 0; font-size: 22px; color: #111827; }
        .content p { margin-bottom: 18px; }
        .button { display: inline-block; padding: 14px 28px; background: #c27d18; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 18px 0; }
        .button:hover { background: #a16207; }
        .muted { color: #6b7280; font-size: 14px; }
        .fallback { background: #f9fafb; border-left: 4px solid #c27d18; padding: 16px; border-radius: 8px; word-break: break-word; }
        .footer { padding: 24px 28px; background: #f9fafb; font-size: 13px; color: #6b7280; text-align: center; }
        .footer a { color: #c27d18; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ {{productName}}</h1>
            <p>Password reset requested</p>
        </div>
        <div class="content">
            <h2>Hi {{friendlyName}},</h2>
            <p>We received a request to reset the password for your {{productName}} account. If this was you, click the button below to choose a new password.</p>
            <p style="text-align: center;">
                <a href="{{resetUrl}}" class="button">Reset Password</a>
            </p>
            <p class="muted">This link will expire in {{expiresInMinutes}} minutes for your security and can only be used once.</p>
            <div class="fallback">
                <strong>Button not working?</strong>
                <p>Copy and paste this link into your browser:<br><a href="{{resetUrl}}">{{resetUrl}}</a></p>
            </div>
            <p>If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            {{#if supportUrl}}
            <p class="muted">Need help? Visit <a href="{{supportUrl}}">Support</a>.</p>
            {{/if}}
        </div>
        <div class="footer">
            <p>You are receiving this email because a password reset was requested at {{baseUrl}}.</p>
            <p>If you no longer wish to receive these alerts, please update your account settings.</p>
        </div>
    </div>
</body>
</html>`
    };

    return templates[templateName] || '';
  }

  async sendEmail(to, subject, htmlContent, textContent) {
    if (this.env.EMAIL_TEST_MODE === 'true') {
      return {
        success: true,
        data: {
          id: `test-email-${Date.now()}`
        }
      };
    }

    // Option 1: Use Cloudflare's built-in email sending (if available)
    if (this.env.SEND_EMAIL) {
      try {
        await this.env.SEND_EMAIL.send({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: to,
          subject: subject,
          html: htmlContent,
          text: textContent || this.htmlToText(htmlContent)
        });
        return { success: true };
      } catch (error) {
        console.error('Cloudflare email send error:', error);
        throw new Error('Failed to send email via Cloudflare');
      }
    }

    // Option 2: Use external service like Resend (free tier)
    if (this.env.RESEND_API_KEY) {
      return await this.sendViaResend(to, subject, htmlContent, textContent);
    }

    // Option 3: Use Mailgun (free tier)
    if (this.env.MAILGUN_API_KEY) {
      return await this.sendViaMailgun(to, subject, htmlContent, textContent);
    }

    throw new Error('No email service configured. Please set up RESEND_API_KEY or MAILGUN_API_KEY');
  }

  // Resend.com integration (free tier: 3000 emails/month)
  async sendViaResend(to, subject, htmlContent, textContent) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: [to],
          subject: subject,
          html: htmlContent,
          text: textContent || this.htmlToText(htmlContent)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Resend API error response:', errorText);

        // Handle specific testing mode limitation
        if (errorText.includes('You can only send testing emails to your own email address')) {
          const match = errorText.match(/email address \(([^)]+)\)/);
          const verifiedEmail = match ? match[1] : 'your verified email';
          return {
            success: false,
            error: `Resend is in testing mode. You can only send emails to ${verifiedEmail}. To send to other recipients, please verify a domain at resend.com/domains.`,
            isTestingMode: true,
            verifiedEmail: verifiedEmail
          };
        }

        return {
          success: false,
          error: `Resend API error (${response.status}): ${errorText}`
        };
      }

      const data = await response.json();
      return { success: true, data: data };
    } catch (error) {
      console.error('Resend API fetch error:', error);
      return {
        success: false,
        error: `Failed to send email via Resend: ${error.message}`
      };
    }
  }

  // Mailgun integration (free tier: 5000 emails/month)
  async sendViaMailgun(to, subject, htmlContent, textContent) {
    const domain = this.env.MAILGUN_DOMAIN;
    const auth = btoa(`api:${this.env.MAILGUN_API_KEY}`);

    // Use URLSearchParams instead of FormData for better Workers compatibility
    const params = new URLSearchParams();
    params.append('from', `${this.fromName} <${this.fromEmail}>`);
    params.append('to', to);
    params.append('subject', subject);
    params.append('html', htmlContent);
    params.append('text', textContent || this.htmlToText(htmlContent));

    const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mailgun API error: ${error}`);
    }

    return { success: true, data: await response.json() };
  }

  // Convert HTML to plain text (basic)
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async sendFamilyInvitation(invitationData) {
    const template = this.getTemplate('family-invitation.html');
    const htmlContent = this.renderTemplate(template, invitationData);
    const textContent = this.htmlToText(htmlContent);

    const subject = `You're invited to join ${invitationData.senderName}'s PowerMeter family account!`;

    const result = await this.sendEmail(
      invitationData.recipientEmail,
      subject,
      htmlContent,
      textContent
    );

    // Return format expected by the API
    return {
      success: result.success,
      error: result.error,
      subject: subject,
      htmlBody: htmlContent,
      textBody: textContent,
      messageId: result.data?.id || 'unknown',
      threadId: result.data?.id || 'unknown'
    };
  }

  async sendNewAccountInvitation(invitationData) {
    const template = this.getTemplate('new-account-invitation.html');
    const htmlContent = this.renderTemplate(template, invitationData);
    const textContent = this.htmlToText(htmlContent);

    const subject = `${invitationData.senderName} recommends PowerMeter for electricity tracking`;

    const result = await this.sendEmail(
      invitationData.recipientEmail,
      subject,
      htmlContent,
      textContent
    );

    // Return format expected by the API
    return {
      success: result.success,
      error: result.error,
      subject: subject,
      htmlBody: htmlContent,
      textBody: textContent,
      messageId: result.data?.id || 'unknown',
      threadId: result.data?.id || 'unknown'
    };
  }

  async sendPasswordResetEmail(data) {
    if (!data?.recipientEmail) {
      throw new Error('recipientEmail is required for password reset emails');
    }

    if (!data?.resetUrl) {
      throw new Error('resetUrl is required for password reset emails');
    }

    const baseUrl = (data.baseUrl || this.baseUrl || '').replace(/\/$/, '');
    const templateVariables = {
      friendlyName: data.friendlyName || 'there',
      resetUrl: data.resetUrl,
      expiresInMinutes: data.expiresInMinutes || 60,
      supportUrl: data.supportUrl || '',
      productName: data.productName || 'PowerMeter',
      baseUrl: baseUrl || 'https://powermeter.app'
    };

    const template = this.getTemplate('password-reset.html');
    const htmlContent = this.renderTemplate(template, templateVariables);
    const textContent = this.htmlToText(htmlContent);

    const subject = `${templateVariables.productName} password reset instructions`;

    const result = await this.sendEmail(
      data.recipientEmail,
      subject,
      htmlContent,
      textContent
    );

    return {
      success: result.success,
      error: result.error,
      subject,
      htmlBody: htmlContent,
      textBody: textContent,
      messageId: result.data?.id || 'unknown',
      threadId: result.data?.id || 'unknown'
    };
  }
}

export default CloudflareEmailService;
