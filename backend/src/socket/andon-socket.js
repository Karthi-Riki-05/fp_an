'use strict';

/**
 * Public, token-scoped Socket.io namespace for Andon TV boards
 * (Sprint 4 / Task 3). Unlike the main namespace (JWT-only), this one
 * authenticates with an Andon board token — so a wall-mounted screen can get
 * real-time pushes without a login. Rooms are scoped `flow:<companyId>:<flowId>`
 * (flow_id is only unique within a tenant, so the companyId must be in the key).
 */

const { resolveToken } = require('../services/andon-tokens.service');
const { getAndon } = require('../services/andon.service');
const { withTenant } = require('../prisma/client');

let _andonNs = null;

function tenantFromCompanyId(id) {
  return { tenantId: Number(id), schemaName: `tenant_${Number(id)}`, dbName: null, timezone: 'Europe/Stockholm' };
}
function roomKey(companyId, flowId) {
  return `flow:${companyId}:${flowId}`;
}

function initAndonNamespace(io) {
  _andonNs = io.of('/andon');

  _andonNs.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('token required'));
      const resolved = await resolveToken(token);
      if (!resolved) return next(new Error('invalid or expired token'));
      socket.companyId = resolved.companyId;
      socket.flowId = resolved.flowId;
      socket.tenant = tenantFromCompanyId(resolved.companyId);
      next();
    } catch (err) {
      next(new Error('auth-error'));
    }
  });

  _andonNs.on('connection', async (socket) => {
    socket.join(roomKey(socket.companyId, socket.flowId));

    // Initial snapshot.
    const pushSnapshot = async () => {
      try {
        const data = await getAndon(socket.tenant, socket.flowId);
        socket.emit('andon:snapshot', data);
      } catch (err) {
        socket.emit('andon:error', { message: 'snapshot failed' });
      }
    };
    await pushSnapshot();

    // Manual resync (client may request after a reconnect).
    socket.on('andon:resync', pushSnapshot);
  });

  console.log('[Socket.io] /andon namespace initialised');
  return _andonNs;
}

/**
 * Relay a machine change to any Andon board watching a flow that contains the
 * machine's equipment. Recomputes a fresh snapshot (cheap, infrequent events)
 * and emits it to the matching `flow:<tenantId>:<flowId>` room — but only when
 * that room actually has connected boards, so idle tenants cost nothing.
 *
 * Hooked into socket.service.emitToMachine so every machine stop start/end
 * (which always accompanies a status change) refreshes the board live.
 */
async function relayMachineToAndon(tenantId, machineId) {
  if (!_andonNs || !tenantId || !machineId) return;
  try {
    const tenant = tenantFromCompanyId(tenantId);
    const flows = await withTenant(tenant, (tx) =>
      tx.$queryRawUnsafe(
        `SELECT DISTINCT fda.flow_design_id AS "flowId"
         FROM machines m
         JOIN flow_design_attributes fda
           ON fda.type = 'Equipment' AND fda.relation_id = m.equipment_id
         WHERE m.id = $1`,
        Number(machineId),
      ),
    );
    for (const f of flows) {
      const key = roomKey(tenantId, f.flowId);
      const hasBoards = (_andonNs.adapter.rooms.get(key)?.size ?? 0) > 0;
      if (!hasBoards) continue;
      const data = await getAndon(tenant, f.flowId);
      _andonNs.to(key).emit('andon:snapshot', data);
    }
  } catch (err) {
    // Best-effort relay — never let a board push break the MQTT/socket path.
  }
}

module.exports = { initAndonNamespace, relayMachineToAndon };
