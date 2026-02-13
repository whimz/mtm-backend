const db = require('../config/db');
const TaskStatus = require('../constants/taskStatuses');

async function getPendingTasks(){
  try{
    const now = new Date().toISOString();
    const query = `
      SELECT * FROM tasks
      WHERE 
        (schedule_type = 'single' AND status = ? AND launch_time > ?)
        OR 
        (schedule_type = 'cron' AND status = ?)
      ORDER BY launch_time ASC
    `;
    const params = [TaskStatus.PENDING, now, TaskStatus.SCHEDULED];

    const tasks = await db.all(query, params);

    if(!tasks || tasks.length === 0){
      return [];
    }
    return tasks;

  }catch(error){     
    console.error('Error fetching tasks: ', error.message);
    throw error;
  }
}


async function getTaskById(id){
  try{
    const query = `SELECT * FROM tasks WHERE id = ?`;
    const task = await db.get(query, [id]);

    if(!task){
      return null;
    }

    return task;
  }catch(error){
    console.error("Error fetching task by ID: ", error.message);
    throw error;
  }
}

module.exports = {
  getPendingTasks,
  getTaskById 
}
