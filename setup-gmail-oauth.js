// Gmail OAuth2 Setup Script
// Run this locally to get your refresh token after setting up Google Cloud Console

const { google } = require('googleapis');
const readline = require('readline');

// Instructions:
// 1. Go to https://console.cloud.google.com/
// 2. Create/select a project
// 3. Enable Gmail API
// 4. Create OAuth2 credentials (Desktop application)
// 5. Download the credentials JSON and extract client_id and client_secret
// 6. Update the values below and run: node setup-gmail-oauth.js

const CLIENT_ID = 'your-client-id-here.apps.googleusercontent.com';
const CLIENT_SECRET = 'your-client-secret-here';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // For installed apps

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

async function getRefreshToken() {
  if (CLIENT_ID === 'your-client-id-here.apps.googleusercontent.com') {
    console.log('❌ Please update CLIENT_ID and CLIENT_SECRET first!');
    console.log('');
    console.log('📋 Setup Instructions:');
    console.log('1. Go to https://console.cloud.google.com/');
    console.log('2. Create/select a project');
    console.log('3. Enable Gmail API');
    console.log('4. Go to Credentials → Create Credentials → OAuth client ID');
    console.log('5. Choose "Desktop application" as application type');
    console.log('6. Download the JSON file and extract client_id and client_secret');
    console.log('7. Update this script with your credentials');
    return;
  }

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent to get refresh token
  });

  console.log('🔗 Open this URL in your browser:');
  console.log(authUrl);
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('📝 Enter the authorization code from the browser: ', async (code) => {
    rl.close();

    try {
      const { tokens } = await oauth2Client.getAccessToken(code);

      console.log('');
      console.log('✅ Success! Here are your tokens:');
      console.log('');
      console.log('GMAIL_CLIENT_ID=' + CLIENT_ID);
      console.log('GMAIL_CLIENT_SECRET=' + CLIENT_SECRET);
      console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
      console.log('GMAIL_ACCESS_TOKEN=' + tokens.access_token);
      console.log('');
      console.log('🚀 Next steps:');
      console.log('Run these commands to set production secrets:');
      console.log('');
      console.log('npx wrangler secret put GMAIL_CLIENT_ID');
      console.log('npx wrangler secret put GMAIL_CLIENT_SECRET');
      console.log('npx wrangler secret put GMAIL_REFRESH_TOKEN');
      console.log('npx wrangler secret put GMAIL_ACCESS_TOKEN');

    } catch (error) {
      console.error('❌ Error getting tokens:', error.message);
    }
  });
}

getRefreshToken();