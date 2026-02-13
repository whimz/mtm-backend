const db = require('../config/db');
const { getPendingTasks, getTaskById } = require('../services/taskService');
const { submitFormWithPuppeteer } = require('../services/formSubmitter');
const { broadcastStatusUpdate } = require('../controllers/taskEventsController');
const { checkEmailForTask } = require('../services/emailChecker');
const { CronExpressionParser } = require('cron-parser');
const TaskStatus = require('../constants/taskStatuses');

const taskTimers = {};
const cronTimers = {};

async function initTaskScheduler(){
  console.log("⏳ Task scheduler starting...");

  try {
    const tasks = await getPendingTasks();
    if (!tasks || tasks.length === 0) {
      console.log("📭 No pending tasks found.");
      return;
    }

    tasks.forEach(task => {
      scheduleTask(task).catch(err => {
        console.error(`❌ Failed to schedule task "${task.id}":`, err.message);
      });
    });

  } catch (err) {
    console.error("❌ Error initializing scheduler:", err.message);
  }
};


async function scheduleTask(task){
  if (task.schedule_type === 'single') {
    scheduleSingleTask(task);
  } else if (task.schedule_type === 'cron') {
    await scheduleCronTask(task);
  }
};

function scheduleSingleTask(task) {
  const delay = new Date(task.launch_time) - Date.now();

  if (delay <= 0) {
    console.log(`⚠️ Task "${task.title}" launch time already passed. Skipping...`);
    return;
  }

  console.log(`📅 Single task "${task.title}" scheduled in ${(delay / 1000 / 60 / 60).toFixed(0)} hours`);

  taskTimers[task.id] = setTimeout(() => {
    executeTask(task).catch(err => {
      console.error("❌ Unhandled error in executeTask:", err.message);
    });
  }, delay);
}

async function scheduleCronTask(task) {
  try {
    const interval = CronExpressionParser.parse(task.cron_expression);

    const nextDate = interval.next().toDate();
    const delay = nextDate - new Date();

    console.log(`🔁 Cron task "${task.title}" next run in ${(delay / 1000 / 60 / 60).toFixed(0)} hours`);

    cronTimers[task.id] = setTimeout(async () => {
      try {
        await executeCronTask(task);
        await updateTaskStatus(task.id, TaskStatus.SCHEDULED);
        broadcastStatusUpdate({ id: task.id, status: TaskStatus.SCHEDULED });
        await scheduleCronTask(task); // Reschedule after execution
      } catch (err) {
        console.error(`❌ Failed to execute cron task "${task.title}":`, err.message);
      }
    }, delay);
  } catch (err) {
    console.error(`❌ Invalid cron expression for task "${task.title}":`, err.message);
  }
}

async function executeCronTask(task) {
  console.log(`🔄 Running cron task "${task.title}"`);
  await executeTask(task);
}

async function executeTask(task) {
  let status = TaskStatus.RUNNING;
  console.log(`🚀 Executing task "${task.title}" (ID: ${task.id})`);
  broadcastStatusUpdate({ id: task.id, status });

  const formSubmittedAt = new Date().toISOString();

  try {
    const parsedInputs = JSON.parse(task.inputs);
    await submitFormWithPuppeteer(task.url, parsedInputs);
    status = TaskStatus.COMPLETE;

    // Check email if configured
    if (task.email_account_id) {
      console.log(`📧 Starting email check for task "${task.title}"`);
      broadcastStatusUpdate({ id: task.id, status: 'CHECKING_EMAIL' });
      
      const emailResult = await checkEmailForTask(task, formSubmittedAt);
      
      if (emailResult) {
        broadcastStatusUpdate({ 
          id: task.id, 
          status: status,
          emailReceived: emailResult.received 
        });
      }
    }

  } catch (error) {
    console.error(`❌ Error in task "${task.title}":`, error.message);
    status = TaskStatus.FAILED;
  } finally {
    deleteTaskTimer(task.id);
    try {
      await updateTaskStatus(task.id, status);
      console.log(`✅ Task "${task.title}" completed with status "${status}"`);
      broadcastStatusUpdate({ id: task.id, status });
    } catch (error) {
      console.error("❌ Failed to update task status:", error.message);
    }
  }
}


async function updateTaskStatus(taskId, status){
  const query = `UPDATE tasks SET status = ? WHERE id = ?`;
  const result = await db.run(query, [status, taskId]);
  if (result.changes === 0) {
    throw new Error(`❌ No task found with ID ${taskId}`);
  }
  console.log(`✅ Task ${taskId} status updated to "${status}"`);
}


/**
 * Reschedules a task if launch_time/cron has been updated.
 * @param {Number} taskId - Id of the updated task from request
 */
async function rescheduleTaskIfUpdated(taskId){

  if (!taskId) return;

  const updatedTask = await getTaskById(taskId);
  if (!updatedTask) return;
  
  deleteTaskTimer(taskId);
  scheduleTask(updatedTask).catch(err => {
    console.error(`❌ Failed to reschedule task "${taskId}":`, err.message);
  });

  
  console.log(`🔄 Task "${taskId}" rescheduled`);
} 

function deleteTaskTimer(taskId) {
  let deleted = false;

  if (taskTimers[taskId]) {
    clearTimeout(taskTimers[taskId]);
    delete taskTimers[taskId];
    console.log(`🧹 Timer cleared for task ${taskId}`);
    deleted = true;
  }

  if (cronTimers[taskId]) {
    clearTimeout(cronTimers[taskId]);
    delete cronTimers[taskId];
    console.log(`🧹 Cron timer cleared for task ${taskId}`);
    deleted = true;
  }

  if (!deleted) {
    console.log(`⚠️ No timer found for task ${taskId}`);
  }
}


module.exports = {
  scheduleTask,
  initTaskScheduler,
  rescheduleTaskIfUpdated,
  deleteTaskTimer
};