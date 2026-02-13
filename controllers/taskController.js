const db = require("../config/db")
const { validateTaskInput } = require("../util/validation")
const { broadcastStatusUpdate } = require("../controllers/taskEventsController")
const { scheduleTask, rescheduleTaskIfUpdated, deleteTaskTimer } = require("../services/taskScheduler")
const TaskStatus = require("../constants/taskStatuses")

async function getAllTasks(req, res, next) {
  try {
    console.log("📋 Fetching all tasks for user:", req.user.id)

    // Get all tasks for the authenticated user (across all their projects)
    const tasks = await db.all(
      `
      SELECT t.*, p.title as project_title, p.id as project_id, ea.email_address
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id 
      LEFT JOIN email_accounts ea ON t.email_account_id = ea.id
      WHERE p.user_id = ? 
      ORDER BY t.created_at DESC
    `,
      [req.user.id],
    )

    console.log("✅ Found tasks:", tasks?.length || 0)

    // Parse inputs JSON for each task
    const parsedTasks = tasks.map((task) => {
      try {
        if (task.inputs) {
          task.inputs = JSON.parse(task.inputs)
        }
      } catch (parseError) {
        console.error("Error parsing inputs for task", task.id, ":", parseError.message)
        task.inputs = {}
      }
      return task
    })

    return res.status(200).json({ tasks: parsedTasks || [] })
  } catch (err) {
    console.error("❌ Error fetching tasks:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getTask(req, res, next) {
  try {
    const taskId = req.params.id
    console.log("📋 Fetching task:", taskId, "for user:", req.user.id)

    // Join with projects table to get project info and verify ownership
    const task = await db.get(
      `
      SELECT t.*, p.title as project_title, p.user_id, p.id as project_id, ea.email_address
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id 
      LEFT JOIN email_accounts ea ON t.email_account_id = ea.id
      WHERE t.id = ?
    `,
      [taskId],
    )

    if (!task) {
      console.log("❌ Task not found:", taskId)
      return res.status(404).json({ error: "Task not found" })
    }

    // Verify task belongs to authenticated user
    if (task.user_id !== req.user.id) {
      console.log("❌ Access denied - task belongs to user:", task.user_id)
      return res.status(403).json({ error: "Access denied" })
    }

    // Parse inputs JSON
    try {
      if (task.inputs) {
        task.inputs = JSON.parse(task.inputs)
      }
    } catch (parseError) {
      console.error("Error parsing inputs:", parseError.message)
      task.inputs = {}
    }

    console.log("✅ Task found:", task.title)

    return res.status(200).json({ task })
  } catch (err) {
    console.error("❌ Error fetching task:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function addTask(req, res, next) {
  try {
    console.log("Creating task with data:", req.body)
    console.log("User:", req.user)

    const validationResult = await validateTaskInput(req.body)

    if (!validationResult.valid) {
      return res.status(422).json({
        message: "Validation failed",
        errors: validationResult.errors,
      })
    }

    const {
      title,
      description,
      url,
      inputs,
      scheduleType,
      scheduleTime,
      cronExpression,
      project_id,
      emailAccountId,
      emailCheckTimeout,
    } = req.body

    if (!title || !url) {
      return res.status(400).json({ error: "Title and URL are required" })
    }

    if (!project_id) {
      return res.status(400).json({ error: "Project ID is required" })
    }

    const project = await db.get("SELECT * FROM projects WHERE id = ? AND user_id = ?", [project_id, req.user.id])

    if (!project) {
      return res.status(404).json({ error: "Project not found or access denied" })
    }

    if (emailAccountId) {
      const emailAccount = await db.get(
        "SELECT * FROM email_accounts WHERE id = ? AND user_id = ? AND is_active = 1",
        [emailAccountId, req.user.id]
      )
      if (!emailAccount) {
        return res.status(404).json({ error: "Email account not found or access denied" })
      }
    }

    const result = await db.run(
      `
      INSERT INTO tasks (
        title, description, url, inputs, 
        schedule_type, launch_time, cron_expression, 
        project_id, status,
        email_account_id, email_check_timeout
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        title,
        description || null,
        url,
        inputs ? JSON.stringify(inputs) : null,
        scheduleType || null,
        scheduleTime || null,
        cronExpression || null,
        project_id,
        TaskStatus.PENDING,
        emailAccountId || null,
        emailCheckTimeout || 30,
      ],
    )

    const taskId = result.lastID

    if (scheduleTime || cronExpression) {
      await scheduleTask(taskId)
    }

    const newTask = await db.get("SELECT * FROM tasks WHERE id = ?", [taskId])

    console.log("Task created successfully:", taskId)

    return res.status(201).json({
      message: "Task created successfully",
      task: newTask,
    })
  } catch (error) {
    console.error("Error creating task:", error)
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    })
  }
}

async function updateTask(req, res, next) {
  try {
    const validationResult = await validateTaskInput(req.body)

    if (!validationResult.valid) {
      return res.status(422).json({
        message: "Validation failed",
        errors: validationResult.errors,
      })
    }

    const taskId = req.params.id
    const { 
      title, 
      description, 
      url, 
      inputs, 
      scheduleType, 
      scheduleTime, 
      cronExpression, 
      status,
      emailAccountId,
      emailCheckTimeout,
    } = req.body

    console.log("Updating task:", taskId)

    if (!title) {
      return res.status(400).json({ error: "Title is required" })
    }

    const task = await db.get(
      `
      SELECT t.*, p.user_id 
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id 
      WHERE t.id = ?
    `,
      [taskId],
    )

    if (!task) {
      return res.status(404).json({ error: "Task not found" })
    }

    if (task.user_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" })
    }

    if (emailAccountId) {
      const emailAccount = await db.get(
        "SELECT * FROM email_accounts WHERE id = ? AND user_id = ? AND is_active = 1",
        [emailAccountId, req.user.id]
      )
      if (!emailAccount) {
        return res.status(404).json({ error: "Email account not found or access denied" })
      }
    }

    const fieldMap = {
      title,
      description,
      url,
      inputs: inputs ? JSON.stringify(inputs) : undefined,
      schedule_type: scheduleType,
      launch_time: scheduleTime,
      cron_expression: cronExpression,
      status: status,
      email_account_id: emailAccountId,
      email_check_timeout: emailCheckTimeout,
      updated_at: new Date().toISOString(),
    }

    const updateFields = []
    const params = {}

    for (const [column, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        updateFields.push(`${column} = ?`)
        params[column] = value
      }
    }

    if (scheduleTime) {
      const launchTimeMs = new Date(scheduleTime).getTime()
      if (!isNaN(launchTimeMs)) {
        if (!updateFields.includes("status = ?")) {
          updateFields.push("status = ?")
          params.status = TaskStatus.PENDING
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "No valid fields to update" })
    }

    const setClause = updateFields.join(", ")
    const values = [...Object.values(params), taskId]
    const sql = `UPDATE tasks SET ${setClause} WHERE id = ?`
    const result = await db.run(sql, values)

    if (result.changes === 0) {
      return res.status(404).json({ message: "Task not found" })
    }

    if (params.launch_time || params.cron_expression) {
      await rescheduleTaskIfUpdated(taskId)
    }

    broadcastStatusUpdate({ id: taskId, status: params.status })

    console.log("Task updated:", taskId)

    const updatedTask = await db.get("SELECT * FROM tasks WHERE id = ?", [taskId])

    return res.status(200).json({
      message: "Task updated successfully",
      task: updatedTask,
    })
  } catch (error) {
    console.error("Error updating task:", error)
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    })
  }
}

async function deleteTask(req, res, next) {
  try {
    const taskId = req.params.id

    console.log("🗑️ Deleting task:", taskId)

    // Verify task belongs to user
    const task = await db.get(
      `
      SELECT t.*, p.user_id 
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id 
      WHERE t.id = ?
    `,
      [taskId],
    )

    if (!task) {
      return res.status(404).json({ error: "Task not found" })
    }

    if (task.user_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" })
    }

    await db.run("DELETE FROM tasks WHERE id = ?", [taskId])

    deleteTaskTimer(taskId)

    console.log("✅ Task deleted:", taskId)

    return res.status(200).json({ message: "Task deleted successfully" })
  } catch (err) {
    console.error("❌ Error deleting task:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

module.exports = {
  getAllTasks,
  getTask,
  addTask,
  updateTask,
  deleteTask,
}
