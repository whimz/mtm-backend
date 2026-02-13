const express = require("express")
const router = express.Router()
const { authMiddleware } = require("../middleware/authMiddleware")
const {
  getAllProjects,
  getProjectById,
  getProjectTasks,
  createProject,
  updateProject,
  deleteProject,
} = require("../controllers/projectsController")

// Apply auth to all routes
router.use(authMiddleware)

router.get("/", getAllProjects)
router.get("/:id", getProjectById)
router.get("/:id/tasks", getProjectTasks)
router.post("/", createProject)
router.patch("/:id", updateProject)
router.delete("/:id", deleteProject)

module.exports = { router }
