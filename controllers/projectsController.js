const db = require("../config/db")

async function getAllProjects(req, res, next) {
  try {
    const projects = await db.all("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC", [req.user.id])

    if (!projects || projects.length === 0) {
      return res.status(200).json({ projects: [], message: "No projects found" })
    }

    return res.status(200).json({ projects })
  } catch (err) {
    console.error("Error fetching projects:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getProjectById(req, res, next) {
  try {
    const projectId = req.params.id

    const project = await db.get("SELECT * FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.id])

    if (!project) {
      return res.status(404).json({ error: "Project not found" })
    }

    return res.status(200).json({ project })
  } catch (err) {
    console.error("Error fetching project:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getProjectTasks(req, res, next) {
  try {
    const projectId = req.params.id

    // Verify project belongs to user
    const project = await db.get("SELECT * FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.id])

    if (!project) {
      return res.status(404).json({ error: "Project not found" })
    }

    // Get all tasks for this project
    const tasks = await db.all("SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC", [projectId])

    return res.status(200).json({ tasks: tasks || [] })
  } catch (err) {
    console.error("Error fetching project tasks:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function createProject(req, res, next) {
  try {
    const { title, description } = req.body

    if (!title) {
      return res.status(400).json({ error: "Title is required" })
    }

    const result = await db.run("INSERT INTO projects (title, description, user_id) VALUES (?, ?, ?)", [
      title,
      description || null,
      req.user.id,
    ])

    const newProject = await db.get("SELECT * FROM projects WHERE id = ?", [result.lastID])

    console.log(newProject)
    return res.status(201).json({ project: newProject })
  } catch (err) {
    console.error("Error creating project:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function updateProject(req, res, next) {
  try {
    const projectId = req.params.id
    const { title, description } = req.body

    if (!title) {
      return res.status(400).json({ error: "Title is required" })
    }

    const project = await db.get("SELECT * FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.id])

    if (!project) {
      return res.status(404).json({ error: "Project not found" })
    }

    await db.run("UPDATE projects SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      title,
      description || null,
      projectId,
    ])

    const updatedProject = await db.get("SELECT * FROM projects WHERE id = ?", [projectId])

    return res.status(200).json({ project: updatedProject })
  } catch (err) {
    console.error("Error updating project:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function deleteProject(req, res, next) {
  try {
    const projectId = req.params.id

    const project = await db.get("SELECT * FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.id])

    if (!project) {
      return res.status(404).json({ error: "Project not found" })
    }

    await db.run("DELETE FROM projects WHERE id = ?", [projectId])

    return res.status(200).json({ message: "Project deleted successfully" })
  } catch (err) {
    console.error("Error deleting project:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

module.exports = {
  getAllProjects,
  getProjectById,
  getProjectTasks,
  createProject,
  updateProject,
  deleteProject,
}
