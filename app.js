require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { router: tasksRouter} = require('./routes/tasks');
const { router: taskEventsRouter } = require('./routes/taskEvents');
const { router: authRouter } = require('./routes/auth');
const { router: projectsRouter} = require('./routes/projects');
const { router: scrapeRouter } = require('./routes/scrapeForms');
const { router: gmailRouter } = require('./routes/gmail');
const { initTaskScheduler } = require('./services/taskScheduler');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  next();
});

app.get('/test-sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send one message immediately
  res.write(`data: ${JSON.stringify({ status: 'connected' })}\n\n`);

  // Then send a message every 2 seconds
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
  }, 2000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

app.use('/tasks/events', taskEventsRouter);

// Auth routes are public (no middleware)
app.use('/auth', authRouter);

// Protected routes (auth applied inside route files)
app.use('/tasks', tasksRouter);
app.use('/projects', projectsRouter);
app.use('/scrape-forms', scrapeRouter);
app.use('/gmail', gmailRouter);

app.use((error, req, res, next) => {
  const status = error.status || 500;
  const message = error.message || 'Something went wrong.';
  res.status(status).json({ message: message });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  initTaskScheduler(); 
});
