const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const gmailController = require('../controllers/gmailController');

// Get OAuth URL (requires auth)
router.get('/auth', authMiddleware, gmailController.getAuthUrl);

// OAuth callback (no auth - user is redirected here from Google)
router.get('/callback', gmailController.handleCallback);

// Get connected email accounts (requires auth)
router.get('/accounts', authMiddleware, gmailController.getAccounts);

// Disconnect email account (requires auth)
router.delete('/accounts/:id', authMiddleware, gmailController.disconnectAccount);

// Get email check results for a task (requires auth)
router.get('/results/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const results = await getResultsForTask(taskId);
    res.json(results);
  } catch (error) {
    console.error('Error fetching email results:', error);
    res.status(500).json({ error: 'Failed to fetch email results' });
  }
});

module.exports = { router };