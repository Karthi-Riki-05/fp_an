'use strict';

/**
 * Test: unconfigured → configured machine Turn Off / Turn On bug fix.
 *
 * Scenario:
 *  Phase 1 — Unconfigured machine Turn Off + Turn On
 *  Phase 2 — Configure machine, repeat Turn Off + Turn On
 *  Phase 3 — Verify MQTT stop/end pipeline still works for a pre-configured machine
 */

const http = require('http');
const { execSync } = require('child_process');

const BASE = 'http://localhost:4000/api/v1';
const COMPANY_ID = 66; // volvo123@gmail.com

let JWT = null;
let passed = 0;
let failed = 0;

// ── helpers ───────────────────────────────────────────────────────────────────

function request(method, path, body) {
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
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function psql(sql) {
  return execSync(
    `docker exec new_fp-postgres-1 psql -U app fp_analyzer -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' },
  ).trim();
}

function pass(label) {
  passed++;
  console.log(`  ✅  ${label}`);
}

function fail(label, detail) {
  failed++;
  console.error(`  ❌  ${label}${detail ? ' — ' + JSON.stringify(detail) : ''}`);
}

function section(title) {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(55));
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── setup ─────────────────────────────────────────────────────────────────────

async function setup() {
  section('Setup — Clean Volvo tenant & insert unconfigured machine');

  // 1. Delete all machine_data, machine_status, and machines rows in tenant_66.
  psql(`DELETE FROM tenant_66.machine_data`);
  psql(`DELETE FROM tenant_66.machine_status`);
  psql(`DELETE FROM tenant_66.machines`);

  // 2. Insert one unconfigured machine (equipment_id = 0).
  const row = psql(
    `INSERT INTO tenant_66.machines
       (equipment_id, unit_name, pin_no, running_status, unit_connected,
        signal_type, installation_date, last_online, updated_at, created_at)
     VALUES (0, 'Test Bug Fix Machine', 999, 'off', 'no',
             'on', NOW(), NOW(), NOW(), NOW())
     RETURNING id`,
  );
  const machineId = parseInt(row, 10);
  if (!machineId) { fail('Insert unconfigured machine'); return null; }

  pass(`Inserted unconfigured machine (id=${machineId}, equipment_id=0)`);
  return machineId;
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function login() {
  section('Login as SuperAdmin');
  const res = await request('POST', '/auth/login', {
    email: 'user1@gmail.com',
    password: 'password123',
  });
  if (res.status !== 200 || !res.headers['set-cookie']) {
    fail('Login', res.body);
    return false;
  }
  const cookie = res.headers['set-cookie'].find((c) => c.startsWith('access_token='));
  JWT = cookie?.split(';')[0]?.replace('access_token=', '');
  if (!JWT) { fail('Extract JWT from cookie'); return false; }
  pass('Logged in as SuperAdmin (user1@gmail.com)');
  return true;
}

// ── DB query helpers ──────────────────────────────────────────────────────────

function getMachineRow(machineId) {
  const row = psql(
    `SELECT running_status, equipment_id FROM tenant_66.machines WHERE id = ${machineId}`,
  );
  const [runningStatus, equipmentId] = row.split('|');
  return { runningStatus: runningStatus?.trim(), equipmentId: parseInt(equipmentId ?? '0') };
}

function getOpenStop(machineId) {
  const row = psql(
    `SELECT id, is_valid_data FROM tenant_66.machine_data WHERE machine_id = ${machineId} AND end_time IS NULL ORDER BY id DESC LIMIT 1`,
  );
  if (!row) return null;
  const [id, isValidData] = row.split('|');
  return { id: parseInt(id), isValidData: isValidData?.trim() === 't' };
}

function getMachineStatus(machineId) {
  const row = psql(
    `SELECT status FROM tenant_66.machine_status WHERE machine_id = ${machineId} LIMIT 1`,
  );
  return row?.trim() || null;
}

function getClosedStop(machineId) {
  const row = psql(
    `SELECT id FROM tenant_66.machine_data WHERE machine_id = ${machineId} AND end_time IS NOT NULL ORDER BY id DESC LIMIT 1`,
  );
  return row ? parseInt(row.trim()) : null;
}

// ── Phase 1: Unconfigured machine ─────────────────────────────────────────────

async function phase1(machineId) {
  section(`Phase 1 — Unconfigured machine (id=${machineId})`);

  // Step 1: Turn Off
  console.log('\n  Step 1: Turn Off (unconfigured machine)');
  const offRes = await request('POST', '/superadmin/test/machine-action', {
    companyId: COMPANY_ID,
    machineId,
    action: 'stop_start',
  });
  if (offRes.status !== 200 || !offRes.body.success) {
    fail('Turn Off API call succeeded', offRes.body);
    return false;
  }
  pass('Turn Off API returned { success: true }');

  await sleep(400); // allow async MQTT handler to complete

  const openStop = getOpenStop(machineId);
  if (openStop && openStop.id) {
    pass(`machine_data row inserted (id=${openStop.id}, is_valid_data=${openStop.isValidData})`);
    if (!openStop.isValidData) {
      pass('is_valid_data = false (correct for unconfigured machine)');
    } else {
      fail('is_valid_data should be false for unconfigured machine');
    }
  } else {
    fail('machine_data row with end_time=NULL not found');
    return false;
  }

  const machineRow = getMachineRow(machineId);
  if (machineRow.runningStatus === 'off') {
    pass(`machines.running_status = 'off'`);
  } else {
    fail(`machines.running_status should be 'off', got: ${machineRow.runningStatus}`);
  }

  const statusAfterOff = getMachineStatus(machineId);
  if (statusAfterOff === 'off') {
    pass(`machine_status = 'off'`);
  } else {
    fail(`machine_status should be 'off', got: ${statusAfterOff}`);
  }

  // Step 2: Turn On
  console.log('\n  Step 2: Turn On (unconfigured machine — should NOT return 409)');
  const onRes = await request('POST', '/superadmin/test/machine-action', {
    companyId: COMPANY_ID,
    machineId,
    action: 'stop_end',
  });
  if (onRes.status !== 200 || !onRes.body.success) {
    fail(`Turn On returned ${onRes.status}`, onRes.body);
    return false;
  }
  pass(`Turn On API returned { success: true } (status=${onRes.status})`);

  await sleep(400);

  const closedStopId = getClosedStop(machineId);
  if (closedStopId) {
    pass(`machine_data row ${closedStopId} now has end_time set`);
  } else {
    // May have used no-open-stop path if stop was closed by handleStopEnd first
    const openAfterOn = getOpenStop(machineId);
    if (!openAfterOn) {
      pass('No open stop remains (stop was closed or no-open-stop path used)');
    } else {
      fail('Open stop still exists after Turn On');
    }
  }

  const machineAfterOn = getMachineRow(machineId);
  if (machineAfterOn.runningStatus === 'on') {
    pass(`machines.running_status = 'on'`);
  } else {
    fail(`machines.running_status should be 'on', got: ${machineAfterOn.runningStatus}`);
  }

  const statusAfterOn = getMachineStatus(machineId);
  if (statusAfterOn === 'on') {
    pass(`machine_status = 'on'`);
  } else {
    fail(`machine_status should be 'on', got: ${statusAfterOn}`);
  }

  return true;
}

// ── Phase 2: Configure machine, repeat Turn Off / Turn On ─────────────────────

async function phase2(machineId) {
  section(`Phase 2 — Configure machine (id=${machineId}) then Turn Off / Turn On`);

  // Find first available equipment in tenant_66
  const equipRow = psql(`SELECT id, name FROM tenant_66.equipment LIMIT 1`);
  if (!equipRow) {
    console.log('  ⚠️  No equipment found in tenant_66 — skipping Phase 2');
    return true;
  }
  const [equipId, equipName] = equipRow.split('|');
  const equipmentId = parseInt(equipId);

  // Configure the machine by assigning equipment
  psql(`UPDATE tenant_66.machines SET equipment_id = ${equipmentId}, updated_at = NOW() WHERE id = ${machineId}`);
  const rowAfterConfig = getMachineRow(machineId);
  if (rowAfterConfig.equipmentId === equipmentId) {
    pass(`Machine configured: equipment_id = ${equipmentId} ("${equipName?.trim()}")`);
  } else {
    fail('Failed to configure machine');
    return false;
  }

  // Step 3: Turn Off (now configured)
  console.log('\n  Step 3: Turn Off (now configured)');
  const offRes = await request('POST', '/superadmin/test/machine-action', {
    companyId: COMPANY_ID,
    machineId,
    action: 'stop_start',
  });
  if (offRes.status !== 200 || !offRes.body.success) {
    fail('Turn Off API call', offRes.body);
    return false;
  }
  pass('Turn Off API returned { success: true }');

  await sleep(400);

  const openStop = getOpenStop(machineId);
  if (openStop && openStop.id) {
    pass(`machine_data row inserted (id=${openStop.id}, is_valid_data=${openStop.isValidData})`);
    if (openStop.isValidData) {
      pass('is_valid_data = true (correct for configured machine)');
    } else {
      fail('is_valid_data should be true for configured machine');
    }
  } else {
    fail('machine_data row with end_time=NULL not found after Turn Off on configured machine');
    return false;
  }

  const machineAfterOff = getMachineRow(machineId);
  if (machineAfterOff.runningStatus === 'off') {
    pass(`machines.running_status = 'off'`);
  } else {
    fail(`machines.running_status should be 'off', got: ${machineAfterOff.runningStatus}`);
  }

  // Step 4: Turn On (configured machine, with valid open stop)
  console.log('\n  Step 4: Turn On (configured machine — should close the open stop)');
  const onRes = await request('POST', '/superadmin/test/machine-action', {
    companyId: COMPANY_ID,
    machineId,
    action: 'stop_end',
  });
  if (onRes.status !== 200 || !onRes.body.success) {
    fail(`Turn On returned ${onRes.status}`, onRes.body);
    return false;
  }
  pass(`Turn On API returned { success: true }`);

  await sleep(400);

  // The stop should be closed now
  const openAfterOn = getOpenStop(machineId);
  if (!openAfterOn) {
    pass('No open stop remains (stop correctly closed)');
  } else {
    fail(`Open stop ${openAfterOn.id} still exists after Turn On`);
  }

  const closedStop = getClosedStop(machineId);
  if (closedStop) {
    pass(`machine_data row ${closedStop} has end_time set`);
  } else {
    fail('No closed machine_data row found');
  }

  const machineAfterOn = getMachineRow(machineId);
  if (machineAfterOn.runningStatus === 'on') {
    pass(`machines.running_status = 'on'`);
  } else {
    fail(`machines.running_status should be 'on', got: ${machineAfterOn.runningStatus}`);
  }

  const statusAfterOn = getMachineStatus(machineId);
  if (statusAfterOn === 'on') {
    pass(`machine_status = 'on'`);
  } else {
    fail(`machine_status should be 'on', got: ${statusAfterOn}`);
  }

  return true;
}

// ── Phase 3: Long-stop suppression works correctly ───────────────────────────

async function phase3(machineId) {
  section(`Phase 3 — Turn Off twice → long-stop suppression, then Turn On`);

  // Turn Off — should insert machine_data (machine_status is 'on' from Phase 2)
  const off1 = await request('POST', '/superadmin/test/machine-action', {
    companyId: COMPANY_ID, machineId, action: 'stop_start',
  });
  await sleep(400);
  const stop1 = getOpenStop(machineId);
  if (off1.status === 200 && stop1) {
    pass(`First Turn Off: machine_data inserted (id=${stop1.id})`);
  } else {
    fail('First Turn Off did not insert machine_data');
    return false;
  }

  // Turn Off again — long-stop suppression should prevent a second insert
  const off2 = await request('POST', '/superadmin/test/machine-action', {
    companyId: COMPANY_ID, machineId, action: 'stop_start',
  });
  await sleep(400);
  const countRow = psql(
    `SELECT COUNT(*) FROM tenant_66.machine_data WHERE machine_id = ${machineId} AND end_time IS NULL`,
  );
  const openCount = parseInt(countRow.trim());
  if (off2.status === 200 && openCount === 1) {
    pass('Second Turn Off triggered long-stop suppression — no duplicate machine_data row');
  } else if (openCount > 1) {
    fail(`Long-stop suppression failed — ${openCount} open rows found`);
  } else {
    fail('Second Turn Off unexpected state');
  }

  // Turn On — should close the single open stop
  const on1 = await request('POST', '/superadmin/test/machine-action', {
    companyId: COMPANY_ID, machineId, action: 'stop_end',
  });
  await sleep(400);
  if (on1.status !== 200 || !on1.body.success) {
    fail('Turn On after long-stop suppression', on1.body);
    return false;
  }
  pass('Turn On returned { success: true }');

  const openAfter = getOpenStop(machineId);
  if (!openAfter) {
    pass('No open stop remains');
  } else {
    fail('Open stop still exists after Turn On');
  }

  const statusFinal = getMachineStatus(machineId);
  if (statusFinal === 'on') {
    pass(`machine_status = 'on' (long-stop suppression loop prevented)`);
  } else {
    fail(`machine_status should be 'on', got: ${statusFinal}`);
  }

  return true;
}

// ── Phase 4: Turn On with no prior stop (fresh machine, no stop history) ─────

async function phase4(machineId) {
  section(`Phase 4 — Turn On with NO prior stop (graceful no-open-stop path)`);

  // Reset: clear all machine_data for this machine, set machine_status = 'on'
  psql(`DELETE FROM tenant_66.machine_data WHERE machine_id = ${machineId}`);
  psql(`UPDATE tenant_66.machine_status SET status = 'on' WHERE machine_id = ${machineId}`);
  psql(`UPDATE tenant_66.machines SET running_status = 'on' WHERE id = ${machineId}`);

  const onRes = await request('POST', '/superadmin/test/machine-action', {
    companyId: COMPANY_ID, machineId, action: 'stop_end',
  });
  if (onRes.status !== 200 || !onRes.body.success) {
    fail(`Turn On with no stop returned ${onRes.status}`, onRes.body);
    return false;
  }
  pass(`Turn On with no prior stop → { success: true } (no 409)`);

  await sleep(200);

  const machine = getMachineRow(machineId);
  if (machine.runningStatus === 'on') {
    pass(`machines.running_status remains 'on'`);
  } else {
    fail(`running_status should stay 'on', got: ${machine.runningStatus}`);
  }

  const status = getMachineStatus(machineId);
  if (status === 'on') {
    pass(`machine_status = 'on'`);
  } else {
    fail(`machine_status should be 'on', got: ${status}`);
  }

  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  Bug Fix Test: Unconfigured → Configured Machine     ║');
  console.log('║  Tests Turn Off / Turn On flow for all scenarios     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const loggedIn = await login();
  if (!loggedIn) process.exit(1);

  const machineId = await setup();
  if (!machineId) process.exit(1);

  await phase1(machineId);
  await phase2(machineId);
  await phase3(machineId);
  await phase4(machineId);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${String(passed).padStart(2)} passed, ${String(failed).padStart(2)} failed                      ║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Test error:', err); process.exit(1); });
