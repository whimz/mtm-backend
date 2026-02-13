const connectedClients = [];
const latestStatuses = {};

function taskStatusEventStream(req, res) {

  setHeaders(res);

  const heartbeat = startHeartbeat(res);

  handleCachedStatuses(res);

  // Send snapshot complete event
  res.write(`event: snapshot-complete\ndata: {"ready": true}\n\n`);

  // Track client connection
  connectedClients.push(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(res);
  });

  res.on('error', (err) => {
    console.error('SSE error:', err);
    clearInterval(heartbeat);
    removeClient(res);
    res.end();
  });
}

// Broadcast task status update
// {id, status}
function broadcastStatusUpdate(updatedTask) {

  const { id: taskId, status } = updatedTask;

  // Update in-memory cache
  latestStatuses[taskId] = status;

  const payload = JSON.stringify({ taskId, status });
  const message = `data: ${payload}\n\n`;
  console.log(message);

  connectedClients.forEach((res) => {
    try {
      res.write(message);
    } catch (err) {
      console.error('Failed to send SSE update: ', err);
      removeClient(res);
      res.end();
    }
  });
}

function setHeaders(res){
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

function handleCachedStatuses(res){
  const hasCachedStatuses = Object.keys(latestStatuses).length > 0;

  if(hasCachedStatuses) {
    Object.entries(latestStatuses).forEach(([taskId, status]) => {
      const payload = JSON.stringify({ taskId, status });
      const message = `data: ${payload}\n\n`;
      res.write(message);
    });
  }
}

function startHeartbeat(res){
  const heartbeat = setInterval(() => {
   try {
      res.write(': heartbeat\n\n');
    } catch (err) {
      try {
        clearInterval(heartbeat);
        removeClient(res);
        res.end();
      } catch (e) {
        // Ignore errors from already-ended responses
      }
    }
  }, 15000);

  return heartbeat;
}

function removeClient(res){
  const index = connectedClients.indexOf(res);
  if (index !== -1) {
    connectedClients.splice(index, 1);
  }
}

module.exports = {
  taskStatusEventStream,
  broadcastStatusUpdate
}