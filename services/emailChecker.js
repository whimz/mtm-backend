const db = require('../config/db');
const { searchEmail } = require('./gmailService');

// Check email with polling
async function checkEmailForTask(task, formSubmittedAt) {
  const {
    id: taskId,
    url: taskUrl,
    email_account_id: emailAccountId,
    email_check_timeout: timeoutMinutes = 30
  } = task;

  if (!emailAccountId) {
    console.log(`Task ${taskId}: No email account configured, skipping email check`);
    return null;
  }

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const pollIntervalMs = 60 * 1000; // Check every 1 minute
  const startTime = Date.now();

  console.log(`Task ${taskId}: Starting email check for domain from ${taskUrl}, timeout ${timeoutMinutes} min`);

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await searchEmail(emailAccountId, {
        url: taskUrl,
        afterTimestamp: formSubmittedAt
      });

      if (result.found) {
        console.log(`Task ${taskId}: Email received`);
        await storeResult(taskId, emailAccountId, true, result.message.id, null);
        return { received: true, messageId: result.message.id };
      }
    } catch (error) {
      console.error(`Task ${taskId}: Email check error:`, error.message);
    }

    // Wait before next check
    await sleep(pollIntervalMs);
  }

  // Timeout reached, email not found
  console.log(`Task ${taskId}: Email not received within ${timeoutMinutes} min`);
  await storeResult(taskId, emailAccountId, false, null, 'Timeout: email not received');
  return { received: false, messageId: null };
}

// Store result in database
async function storeResult(taskId, emailAccountId, received, messageId, errorMessage) {
  await db.run(
    `INSERT INTO email_check_results 
     (task_id, email_account_id, email_received, gmail_message_id, error_message) 
     VALUES (?, ?, ?, ?, ?)`,
    [taskId, emailAccountId, received ? 1 : 0, messageId, errorMessage]
  );
}

// Get email check results for a task
async function getResultsForTask(taskId) {
  return await db.all(
    `SELECT * FROM email_check_results WHERE task_id = ? ORDER BY checked_at DESC`,
    [taskId]
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  checkEmailForTask,
  getResultsForTask
};