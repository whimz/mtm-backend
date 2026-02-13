const express = require('express');
const router = express.Router();
const { taskStatusEventStream } = require('../controllers/taskEventsController');

// SSE endpoint
router.get('/status-updates', taskStatusEventStream);

module.exports = { router };