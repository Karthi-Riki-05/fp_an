'use strict';

require('dotenv').config();

const app = require('./app');
const { disconnect } = require('./prisma/client');
const { quit } = require('./redis/client');
const { syncSchemas } = require('./services/tenant-schema.service');

const port = Number(process.env.PORT ?? 4000);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Backend listening on http://0.0.0.0:${port}/api/v1`);
  console.log(`Swagger UI:           http://0.0.0.0:${port}/api/docs`);
  // Ensure each Company user's tenant_<id> schema mirrors tenant_template.
  syncSchemas().catch((err) => console.error('[startup] syncSchemas failed:', err.message));
});

async function shutdown() {
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
