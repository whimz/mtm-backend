const TaskStatus = {
  PENDING: 'PENDING',
  SCHEDULED: 'SCHEDULED',
  RUNNING: 'RUNNING',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
  DISABLED: 'DISABLED'
};

Object.freeze(TaskStatus);

module.exports = TaskStatus;