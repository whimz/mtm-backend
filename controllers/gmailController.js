const { google } = require('googleapis');
const db = require('../config/db');

// Create OAuth2 client
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
}

// Generate OAuth URL for user to connect Gmail
const getAuthUrl = async (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      state: JSON.stringify({ userId: req.user.id })
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
};

// Handle OAuth callback
const handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }

    const { userId } = JSON.parse(state);
    const oauth2Client = getOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user's email address from Gmail API
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const emailAddress = profile.data.emailAddress;

    // Check if this email is already connected for this user
    const existing = await db.get(
      'SELECT id, is_active FROM email_accounts WHERE user_id = ? AND email_address = ?',
      [userId, emailAddress]
    );

    if (existing) {
      // Reactivate and update tokens if already exists
      await db.run(
        'UPDATE email_accounts SET refresh_token = ?, access_token = ?, is_active = 1 WHERE id = ?',
        [tokens.refresh_token, tokens.access_token, existing.id]
      );
    } else {
      // Insert new email account
      await db.run(
        'INSERT INTO email_accounts (user_id, email_address, refresh_token, access_token) VALUES (?, ?, ?, ?)',
        [userId, emailAddress, tokens.refresh_token, tokens.access_token]
      );
    }

    // Redirect to frontend success page
    res.redirect(`${process.env.FRONTEND_URL}/settings?connected=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings?connected=failed`);
  }
};

// Get user's connected email accounts
const getAccounts = async (req, res) => {
  try {
    const accounts = await db.all(
      'SELECT id, email_address, is_active, connected_at FROM email_accounts WHERE user_id = ? AND is_active = 1',
      [req.user.id]
    );

    res.json(accounts);
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    res.status(500).json({ error: 'Failed to fetch email accounts' });
  }
};

// Disconnect email account (soft delete)
const disconnectAccount = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify account belongs to user
    const account = await db.get(
      'SELECT id FROM email_accounts WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    await db.run('UPDATE email_accounts SET is_active = 0 WHERE id = ?', [id]);

    res.json({ message: 'Email account disconnected' });
  } catch (error) {
    console.error('Error disconnecting account:', error);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
};

module.exports = {
  getAuthUrl,
  handleCallback,
  getAccounts,
  disconnectAccount
};