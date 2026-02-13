const { google } = require('googleapis');
const db = require('../config/db');

// Create OAuth2 client with user's tokens
async function getGmailClient(emailAccountId) {
  const account = await db.get(
    'SELECT refresh_token, access_token FROM email_accounts WHERE id = ? AND is_active = 1',
    [emailAccountId]
  );

  if (!account) {
    throw new Error('Email account not found or inactive');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: account.refresh_token,
    access_token: account.access_token
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch (error) {
    console.error('Failed to parse URL:', url);
    return null;
  }
}

// Search for email in inbox
async function searchEmail(emailAccountId, searchCriteria) {
  const gmail = await getGmailClient(emailAccountId);

  const { url, afterTimestamp } = searchCriteria;

  // Build Gmail search query
  let query = '';
  
  // Extract domain from URL and search for emails from that domain
  const domain = extractDomain(url);
  if (domain) {
    query += `from:@${domain} `;
  }
  
  if (afterTimestamp) {
    const seconds = Math.floor(new Date(afterTimestamp).getTime() / 1000);
    query += `after:${seconds} `;
  }

  console.log('Gmail search query:', query.trim());

  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query.trim(),
      maxResults: 5
    });

    const messages = response.data.messages || [];
    
    if (messages.length === 0) {
      return { found: false, message: null };
    }

    // Get details of first matching message
    const messageDetails = await gmail.users.messages.get({
      userId: 'me',
      id: messages[0].id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date']
    });

    return {
      found: true,
      message: {
        id: messageDetails.data.id,
        headers: messageDetails.data.payload.headers
      }
    };
  } catch (error) {
    console.error('Gmail search error:', error.message);
    throw error;
  }
}

module.exports = {
  getGmailClient,
  searchEmail,
  extractDomain
};