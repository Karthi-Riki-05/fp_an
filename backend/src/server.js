'use strict';

require('dotenv').config();

const http = require('http');
const app = require('./app');
const { disconnect } = require('./prisma/client');
const { quit } = require('./redis/client');
const { syncSchemas } = require('./services/tenant-schema.service');
const socketService = require('./services/socket.service');
const mqttService = require('./services/mqtt.service');

const port = Number(process.env.PORT ?? 4000);

// Create a plain HTTP server so Socket.io can attach to the same handle.
const server = http.createServer(app);

// Attach Socket.io — must happen before server.listen.
socketService.init(server);

// Give the MQTT service a reference to socketService for emitting events.
mqttService.setSocketService(socketService);

server.listen(port, '0.0.0.0', () => {
  console.log(`Backend listening on http://0.0.0.0:${port}/api/v1`);
  console.log(`Swagger UI:           http://0.0.0.0:${port}/api/docs`);
  console.log(`Socket.io:            http://0.0.0.0:${port}/socket.io`);
  // Ensure each Company user's tenant_<id> schema mirrors tenant_template.
  syncSchemas().catch((err) => console.error('[startup] syncSchemas failed:', err.message));
  // Start MQTT subscriber (no-op if MQTT_BROKER_URL is unset).
  mqttService.connect();
});

async function shutdown() {
  mqttService.disconnect();
  server.close(async () => {
    await disconnect();
    await quit();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});
