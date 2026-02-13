const express = require("express");
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getAllTasks, getTask, addTask, updateTask, deleteTask } = require("../controllers/taskController");

router.use(authMiddleware);

router.get('/', getAllTasks);
router.get('/:id', getTask);
router.post('/', addTask);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = { router };
