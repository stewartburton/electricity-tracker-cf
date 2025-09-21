# 🚀 5-Minute Resend Setup

## Step 1: Get Resend API Key
1. Go to [resend.com](https://resend.com)
2. Sign up (free)
3. Go to **API Keys** → **Create API Key**
4. Name it "PowerMeter"
5. Copy the API key (starts with `re_`)

## Step 2: Set Cloudflare Secret
```bash
npx wrangler secret put RESEND_API_KEY
```
Paste your API key when prompted.

## Step 3: Deploy & Test
```bash
npx wrangler deploy
```

Go to https://powermeter.app/settings → Email Invitations and test!

## 📧 What You Get
- **3,000 free emails/month**
- **Professional delivery**
- **No OAuth complexity**
- **Works immediately**

The system will use `noreply@resend.dev` as the from address (you can customize this later).