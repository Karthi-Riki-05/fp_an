'use strict';

const { ping: dbPing } = require('../prisma/client');
const { ping: redisPing } = require('../redis/client');

const bootedAt = Date.now();

async function check() {
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);
  const overall = db.status === 'ok' && redis.status === 'ok' ? 'ok' : 'degraded';
  return { status: overall, uptime_s: Math.floor((Date.now() - bootedAt) / 1000), timestamp: new Date().toISOString(), checks: { db, redis }, version: process.env.npm_package_version ?? '0.1.0' };
}

async function checkDb() {
  try {
    const { latency_ms } = await dbPing();
    return { status: 'ok', latency_ms };
  } catch (err) {
    return { status: 'fail', error: err.message };
  }
}

async function checkRedis() {
  try {
    const { latency_ms } = await redisPing();
    return { status: 'ok', latency_ms };
  } catch (err) {
    return { status: 'fail', error: err.message };
  }
}

module.exports = { check };
