const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const Token = require('../models/Token');
require('dotenv').config();

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ─────────────────────────────────────────
// Known payment senders
// ─────────────────────────────────────────
const PAYMENT_SENDERS = [
  'alerts@phonepe.com',
  'noreply@gpay.com',
  'no-reply@amazon.in',
  'order-update@amazon.in',
  'no-reply@swiggy.in',
  'noreply@swiggy.in',
  'noreply@zomato.com',
  'no-reply@zomato.com',
  'alerts@paytm.com',
  'noreply@paytm.com',
  'transactions@axisbank.com',
  'alerts@hdfcbank.net',
  'alerts@icicibank.com',
  'alerts@sbi.co.in'
];

// ─────────────────────────────────────────
// STEP 1 — Start Gmail Auth
// Usage: GET /api/gmail/auth?userId=abc-123
// ─────────────────────────────────────────
router.get('/auth', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state: userId
  });

  res.redirect(authUrl);
});

// ─────────────────────────────────────────
// STEP 2 — Gmail OAuth Callback
// ─────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state: userId } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);

    await Token.findOneAndUpdate(
      { userId },
      {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(tokens.expiry_date)
      },
      { upsert: true, new: true }
    );

    res.send('Gmail connected successfully! You can close this window and return to the app.');
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// ─────────────────────────────────────────
// STEP 3 — Fetch Emails from Payment Senders
// Usage: GET /api/gmail/fetch-transactions?userId=abc-123
// ─────────────────────────────────────────
router.get('/fetch-transactions', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const tokenDoc = await Token.findOne({ userId });
    if (!tokenDoc) return res.status(404).json({ error: 'User not connected to Gmail yet' });

    oauth2Client.setCredentials({
      access_token: tokenDoc.accessToken,
      refresh_token: tokenDoc.refreshToken,
      expiry_date: tokenDoc.tokenExpiry
    });

    // Auto refresh token if expired
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await Token.findOneAndUpdate(
          { userId },
          {
            accessToken: tokens.access_token,
            tokenExpiry: new Date(tokens.expiry_date)
          }
        );
      }
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Build sender filter query
    const senderQuery = PAYMENT_SENDERS.map(s => `from:${s}`).join(' OR ');

    // Fetch emails from payment senders only
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: senderQuery
    });

    const messages = response.data.messages || [];
    const emails = [];

    for (const message of messages) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });

      const headers = msg.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      emails.push({ id: message.id, from, subject, date });
    }

    res.json({ success: true, count: emails.length, emails });

  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

module.exports = router;