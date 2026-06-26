/**
 * SuperAdmin MQTT + WebSocket automated test suite.
 * Runs all 8 test scenarios against the running stack.
 */
'use strict';

const http = require('http');

const BASE = 'http://localhost:4000/api/v1';
let JWT = null;

// ── helpers ──────────────────────────────────────────────────────────────────

function request(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(JWT ? { Cookie: `access_token=${JWT}` } : {}),
        ...extraHeaders,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.status || res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.status || res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let passed = 0, failed = 0;
function pass(name) { console.log(`  ✅ ${name}`); passed++; }
function fail(name, reason) { console.log(`  ❌ ${name}: ${reason}`); failed++; }

// ── Test 1: Login as SuperAdmin ───────────────────────────────────────────────
async function test1_login() {
  console.log('\n[Test 1] Login as Super Admin');
  const r = await request('POST', '/auth/login', {
    email: 'user1@gmail.com',
    password: 'password123',
  });
  if (r.status !== 200) { fail('login', `HTTP ${r.status}: ${JSON.stringify(r.body)}`); return false; }
  // JWT is in Set-Cookie header
  const setCookie = r.headers['set-cookie'];
  if (!setCookie) { fail('login', 'no Set-Cookie header'); return false; }
  const match = Array.isArray(setCookie)
    ? setCookie.join(';').match(/access_token=([^;]+)/)
    : String(setCookie).match(/access_token=([^;]+)/);
  if (!match) { fail('login', 'access_token not in cookie'); return false; }
  JWT = match[1];
  pass(`Logged in, JWT length=${JWT.length}`);

  // Verify it's a SuperAdmin (roles should include Administrator)
  const me = await request('GET', '/me');
  if (!me.body?.isAdmin) { fail('SuperAdmin role check', `isAdmin=${me.body?.isAdmin}`); return false; }
  pass(`Role confirmed: isAdmin=${me.body.isAdmin}, roles=${me.body.roles}`);
  return true;
}

// ── Test 2: Fetch company list ────────────────────────────────────────────────
async function test2_companies() {
  console.log('\n[Test 2] Fetch company list');
  const r = await request('GET', '/superadmin/companies');
  if (r.status !== 200) { fail('GET /superadmin/companies', `HTTP ${r.status}`); return null; }
  if (!Array.isArray(r.body?.data)) { fail('response shape', 'data not array'); return null; }
  const companies = r.body.data;
  pass(`Got ${companies.length} companies`);
  if (companies.length === 0) { fail('at least one company', 'no companies found'); return null; }
  // Show first company
  const c = companies[0];
  pass(`First company: id=${c.id}, name=${c.name}, machines=${c.machineCount}`);
  return companies;
}

// ── Test 3: Fetch machines for a company ─────────────────────────────────────
async function test3_machines(companyId) {
  console.log(`\n[Test 3] Fetch machines for company ${companyId}`);
  const r = await request('GET', `/superadmin/companies/${companyId}/machines`);
  if (r.status !== 200) { fail('GET machines', `HTTP ${r.status}`); return null; }
  const machines = r.body?.data;
  if (!Array.isArray(machines)) { fail('response shape', 'data not array'); return null; }
  pass(`Got ${machines.length} machines for company ${companyId}`);
  if (machines.length === 0) { fail('at least one machine', 'no machines found'); return null; }
  const m = machines[0];
  pass(`First machine: id=${m.machineId}, name=${m.unitName}, status=${m.runningStatus}`);
  return machines;
}

// ── Test 4: Socket.io admin connection + admin:join:all ───────────────────────
async function test4_socket() {
  console.log('\n[Test 4] Socket.io admin connection + admin:join:all');
  const io = require('socket.io-client');
  return new Promise((resolve) => {
    const socket = io('http://localhost:4000', {
      path: '/socket.io',
      extraHeaders: { Cookie: `access_token=${JWT}` },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 10000,
    });

    const TIMEOUT = setTimeout(() => {
      fail('Socket timeout', 'no admin:joined in 10s');
      socket.disconnect();
      resolve(false);
    }, 10000);

    socket.on('connect', () => {
      pass(`Socket connected, id=${socket.id}`);
      socket.emit('admin:join:all');
    });

    socket.on('admin:joined', (data) => {
      clearTimeout(TIMEOUT);
      pass(`admin:joined received, tenantIds=${JSON.stringify(data.tenantIds)}`);
      socket.disconnect();
      resolve(data.tenantIds);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(TIMEOUT);
      fail('connect_error', err.message);
      resolve(false);
    });
  });
}

// ── Test 5: Simulate "Turn Off" → verify DB + Socket event ───────────────────
async function test5_turnOff(companyId, machineId) {
  console.log(`\n[Test 5] Turn Off — company=${companyId} machine=${machineId}`);
  const io = require('socket.io-client');

  // Count existing machine_data rows before
  // (we check the API response and socket event instead)

  return new Promise(async (resolve) => {
    const socket = io('http://localhost:4000', {
      path: '/socket.io',
      extraHeaders: { Cookie: `access_token=${JWT}` },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 15000,
    });

    let stopStartedReceived = false;

    const TIMEOUT = setTimeout(() => {
      fail('stop_start socket event', `machine:stop:started not received in 12s (event=${stopStartedReceived})`);
      socket.disconnect();
      resolve(false);
    }, 12000);

    socket.on('connect', () => {
      socket.emit('admin:join:all');
    });

    socket.on('admin:joined', async () => {
      // Now trigger the action
      const r = await request('POST', '/superadmin/test/machine-action', {
        companyId,
        machineId,
        action: 'stop_start',
      });
      if (r.status !== 200) {
        fail('stop_start API', `HTTP ${r.status}: ${JSON.stringify(r.body)}`);
        clearTimeout(TIMEOUT);
        socket.disconnect();
        resolve(false);
        return;
      }
      pass(`stop_start API returned 200, topic=${r.body.topic}`);
    });

    socket.on('machine:stop:started', async (data) => {
      if (data.machineId !== machineId) return; // event for a different machine
      stopStartedReceived = true;
      clearTimeout(TIMEOUT);
      pass(`machine:stop:started received: machineId=${data.machineId}, tenantId=${data.tenantId}`);

      // Wait for async DB write then verify
      await sleep(300);
      // Check DB via the machines endpoint
      const mr = await request('GET', `/superadmin/companies/${companyId}/machines`);
      const m = mr.body?.data?.find((x) => x.machineId === machineId);
      if (m?.runningStatus === 'off') {
        pass(`DB confirmed: machines.running_status = 'off'`);
      } else {
        fail('DB check', `running_status=${m?.runningStatus}`);
      }
      socket.disconnect();
      resolve(true);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(TIMEOUT);
      fail('socket connect_error', err.message);
      resolve(false);
    });
  });
}

// ── Test 6: Simulate "Turn On" → stop:ended event ────────────────────────────
async function test6_turnOn(companyId, machineId) {
  console.log(`\n[Test 6] Turn On — company=${companyId} machine=${machineId}`);
  const io = require('socket.io-client');

  return new Promise(async (resolve) => {
    const socket = io('http://localhost:4000', {
      path: '/socket.io',
      extraHeaders: { Cookie: `access_token=${JWT}` },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 15000,
    });

    const TIMEOUT = setTimeout(() => {
      fail('stop_end socket event', 'machine:stop:ended not received in 12s');
      socket.disconnect();
      resolve(false);
    }, 12000);

    socket.on('connect', () => { socket.emit('admin:join:all'); });

    socket.on('admin:joined', async () => {
      const r = await request('POST', '/superadmin/test/machine-action', {
        companyId,
        machineId,
        action: 'stop_end',
      });
      if (r.status !== 200) {
        fail('stop_end API', `HTTP ${r.status}: ${JSON.stringify(r.body)}`);
        clearTimeout(TIMEOUT);
        socket.disconnect();
        resolve(false);
        return;
      }
      pass(`stop_end API returned 200, topic=${r.body.topic}`);
    });

    socket.on('machine:stop:ended', async (data) => {
      if (data.machineId !== machineId) return;
      clearTimeout(TIMEOUT);
      pass(`machine:stop:ended received: machineId=${data.machineId}, tenantId=${data.tenantId}`);
      await sleep(300);
      const mr = await request('GET', `/superadmin/companies/${companyId}/machines`);
      const m = mr.body?.data?.find((x) => x.machineId === machineId);
      if (m?.runningStatus === 'on') {
        pass(`DB confirmed: machines.running_status = 'on'`);
      } else {
        fail('DB check after stop_end', `running_status=${m?.runningStatus}`);
      }
      socket.disconnect();
      resolve(true);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(TIMEOUT);
      fail('socket connect_error', err.message);
      resolve(false);
    });
  });
}

// ── Test 7: Simulate Heartbeat ────────────────────────────────────────────────
async function test7_heartbeat(companyId, machineId) {
  console.log(`\n[Test 7] Heartbeat — company=${companyId} machine=${machineId}`);
  const io = require('socket.io-client');

  // Record last_online before
  const before = await request('GET', `/superadmin/companies/${companyId}/machines`);
  const mBefore = before.body?.data?.find((x) => x.machineId === machineId);
  const lastOnlineBefore = mBefore?.lastOnline;

  return new Promise(async (resolve) => {
    const socket = io('http://localhost:4000', {
      path: '/socket.io',
      extraHeaders: { Cookie: `access_token=${JWT}` },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 15000,
    });

    const TIMEOUT = setTimeout(() => {
      fail('heartbeat socket event', 'machine:status:changed not received in 12s');
      socket.disconnect();
      resolve(false);
    }, 12000);

    socket.on('connect', () => { socket.emit('admin:join:all'); });

    socket.on('admin:joined', async () => {
      const r = await request('POST', '/superadmin/test/machine-action', {
        companyId,
        machineId,
        action: 'heartbeat',
      });
      if (r.status !== 200) {
        fail('heartbeat API', `HTTP ${r.status}: ${JSON.stringify(r.body)}`);
        clearTimeout(TIMEOUT);
        socket.disconnect();
        resolve(false);
        return;
      }
      pass(`heartbeat API returned 200, topic=${r.body.topic}`);
    });

    socket.on('machine:status:changed', async (data) => {
      if (data.machineId !== machineId) return;
      clearTimeout(TIMEOUT);
      pass(`machine:status:changed received: machineId=${data.machineId}, tenantId=${data.tenantId}`);
      await sleep(300);
      const after = await request('GET', `/superadmin/companies/${companyId}/machines`);
      const mAfter = after.body?.data?.find((x) => x.machineId === machineId);
      if (mAfter?.lastOnline && mAfter.lastOnline !== lastOnlineBefore) {
        pass(`last_online updated: ${mAfter.lastOnline}`);
      } else {
        fail('last_online check', `before=${lastOnlineBefore}, after=${mAfter?.lastOnline}`);
      }
      socket.disconnect();
      resolve(true);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(TIMEOUT);
      fail('socket connect_error', err.message);
      resolve(false);
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  SuperAdmin MQTT + WebSocket — Automated Test Suite');
  console.log('═══════════════════════════════════════════════════');

  const ok1 = await test1_login();
  if (!ok1) { console.log('\n⛔ Login failed — aborting'); process.exit(1); }

  const companies = await test2_companies();
  if (!companies) { console.log('\n⛔ Company fetch failed'); process.exit(1); }

  // Use the Volvo company (id=66) for machine tests; fall back to first
  const target = companies.find((c) => c.id === 66) ?? companies[0];
  console.log(`\n  Using company: id=${target.id}, name=${target.name}`);

  const machines = await test3_machines(target.id);
  if (!machines) { console.log('\n⛔ Machines fetch failed'); process.exit(1); }

  const testMachine = machines.find((m) => m.runningStatus === 'on') ?? machines[0];
  console.log(`  Using machine: id=${testMachine.machineId}, name=${testMachine.unitName}, status=${testMachine.runningStatus}`);

  const tenantIds = await test4_socket();

  // Tests 5-7 run sequentially and depend on machine state
  await test5_turnOff(target.id, testMachine.machineId);
  await sleep(500); // small gap between tests
  await test6_turnOn(target.id, testMachine.machineId);
  await sleep(500);
  await test7_heartbeat(target.id, testMachine.machineId);

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
