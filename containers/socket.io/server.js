const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const app = express();
const httpServer = createServer(app);

// Configuration
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const INSTANCE_ID = process.env.HOSTNAME || `instance-${process.pid}`;

// Configure Socket.IO with CORS for containerized environments
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Initialize Redis adapter for clustering
async function initializeRedisAdapter() {
  const pubClient = createClient({ url: REDIS_URL });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
  subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));

  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient));
  console.log(`[${INSTANCE_ID}] Connected to Redis at ${REDIS_URL}`);

  return { pubClient, subClient };
}

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    instance: INSTANCE_ID,
    timestamp: new Date().toISOString()
  });
});

// Cluster info endpoint
app.get('/cluster/info', async (req, res) => {
  try {
    const sockets = await io.fetchSockets();
    res.json({
      instance: INSTANCE_ID,
      connectedClients: sockets.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[${INSTANCE_ID}] Client connected: ${socket.id}`);

  // Send instance info to client
  socket.emit('instance-info', { instanceId: INSTANCE_ID });

  // Example: Handle custom events
  socket.on('message', (data) => {
    console.log(`[${INSTANCE_ID}] Message from ${socket.id}:`, data);
    // Broadcast to all clients across all instances
    socket.broadcast.emit('message', {
      from: socket.id,
      instance: INSTANCE_ID,
      data: data,
      timestamp: new Date().toISOString()
    });
  });

  // Example: Join a room (works across cluster)
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`[${INSTANCE_ID}] ${socket.id} joined room: ${room}`);
    io.to(room).emit('user-joined', {
      userId: socket.id,
      room,
      instance: INSTANCE_ID
    });
  });

  // Example: Leave a room
  socket.on('leave-room', (room) => {
    socket.leave(room);
    console.log(`[${INSTANCE_ID}] ${socket.id} left room: ${room}`);
    io.to(room).emit('user-left', {
      userId: socket.id,
      room,
      instance: INSTANCE_ID
    });
  });

  // Broadcast to room (works across cluster)
  socket.on('room-message', ({ room, message }) => {
    io.to(room).emit('room-message', {
      from: socket.id,
      room,
      message,
      instance: INSTANCE_ID,
      timestamp: new Date().toISOString()
    });
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`[${INSTANCE_ID}] Client disconnected: ${socket.id}, reason: ${reason}`);
  });
});

// Start server with Redis adapter
async function start() {
  try {
    await initializeRedisAdapter();

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`[${INSTANCE_ID}] Socket.IO server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log(`[${INSTANCE_ID}] Received SIGTERM, shutting down gracefully...`);
  httpServer.close(() => {
    console.log(`[${INSTANCE_ID}] HTTP server closed`);
    process.exit(0);
  });
});

start();
