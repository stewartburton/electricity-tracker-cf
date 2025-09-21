# Resend Email Setup (Free & Easy)

Resend is a modern email API that's much simpler than Gmail OAuth and offers 3,000 free emails per month.

## ✅ Why Resend?
- **Free tier**: 3,000 emails/month
- **No OAuth complexity**: Just an API key
- **5-minute setup**: Much faster than Gmail
- **Professional**: Built for developers
- **Great deliverability**: High inbox rates

## 🚀 Quick Setup

### Step 1: Create Resend Account
1. Go to [resend.com](https://resend.com)
2. Sign up with your email
3. Verify your email address

### Step 2: Get API Key
1. In Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Name it "PowerMeter"
4. Copy the API key (starts with `re_`)

### Step 3: Set Cloudflare Secret
```bash
npx wrangler secret put RESEND_API_KEY
# Paste your API key when prompted
```

### Step 4: Update EmailService
We'll switch from Gmail to Resend in the index.js file.

### Step 5: Test
Deploy and test at https://powermeter.app/settings

## 📧 Email Configuration

### From Address Options:
1. **Use Resend domain** (immediate): `noreply@resend.dev`
2. **Use your domain** (if you own powermeter.app): `noreply@powermeter.app`
3. **Custom domain** (requires DNS setup): `noreply@yourdomain.com`

### Domain Setup (Optional)
If you want to use your own domain:
1. In Resend dashboard, go to **Domains**
2. Add your domain
3. Add the required DNS records
4. Verify the domain

## 🔧 Environment Variables Needed

Only one secret required:
```bash
RESEND_API_KEY=re_your_api_key_here
```

## 📊 Free Tier Limits
- **3,000 emails/month**
- **100 emails/day**
- All features included
- No credit card required

Perfect for PowerMeter's invitation system!

## 🆚 Comparison

| Service | Free Emails | Setup Time | Complexity |
|---------|-------------|------------|-----------|
| Gmail OAuth | Unlimited | 30+ min | High |
| Resend | 3,000/month | 5 min | Low |
| Mailgun | 5,000/month | 10 min | Medium |

**Recommendation**: Start with Resend for simplicity!