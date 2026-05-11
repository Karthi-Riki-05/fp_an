'use strict';

const IORedis = require('ioredis');

const url = process.env.REDIS_URL || 'redis://redis:6379';

const redis = new IORedis(url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err) => console.error(`Redis error: ${err.message}`));
redis.on('ready', () => console.log('Redis ready.'));

async function ping() {
  const t0 = Date.now();
  const reply = await redis.ping();
  if (reply !== 'PONG') throw new Error(`Unexpected PING reply: ${reply}`);
  return { ok: true, latency_ms: Date.now() - t0 };
}

async function quit() {
  await redis.quit().catch(() => undefined);
}

module.exports = { redis, ping, quit };
