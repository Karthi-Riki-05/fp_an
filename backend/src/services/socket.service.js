'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { prisma, withTenant } = require('../prisma/client');
const { initAndonNamespace, relayMachineToAndon } = require('../socket/andon-socket');

let _io = null;

function init(httpServer) {
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3030,http://localhost:3000')
    .split(',').map((s) => s.trim()).filter(Boolean);

  _io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    path: '/socket.io',
  });

  _io.use(async (socket, next) => {
    try {
      // 1. Explicit token in auth object (mobile / non-cookie callers).
      // 2. Bearer Authorization header.
      // 3. access_token httpOnly cookie sent automatically by the browser via
      //    withCredentials. Parse it from the raw Cookie header.
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers?.authorization?.startsWith('Bearer ')) {
        token = socket.handshake.headers.authorization.slice(7);
      }
      if (!token) {
        const cookieHeader = socket.handshake.headers?.cookie ?? '';
        const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
        if (match) token = decodeURIComponent(match[1]);
      }

      if (!token) return next(new Error('unauthorized'));

      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      } catch {
        return next(new Error('invalid-token'));
      }
      if (payload.kind !== 'web') return next(new Error('wrong-token-kind'));

      const user = await prisma.user.findFirst({
        where: { id: payload.sub, deletedAt: null },
        select: {
          id: true, companyId: true, status: true, timezone: true,
          userRoles: { select: { role: { select: { name: true } } } },
        },
      });

      if (!user || user.status !== 1) return next(new Error('user-not-found'));

      const roles = user.userRoles.map((ur) => ur.role.name);
      const isAdmin = roles.includes('Administrator');
      let tenantId;
      if (roles.includes('Company')) {
        tenantId = user.id;
      } else if (roles.includes('User') && user.companyId) {
        tenantId = user.companyId;
      } else if (isAdmin) {
        // Admins may pass ?tenantId= for scoped monitoring; omit it to connect
        // globally and call admin:join:all to subscribe to every tenant room.
        const headerTenantId = socket.handshake.query?.tenantId;
        if (headerTenantId) tenantId = parseInt(headerTenantId, 10);
      }

      if (!tenantId && !isAdmin) return next(new Error('no-tenant-context'));

      socket.tenantId = tenantId || null;
      socket.isAdmin = isAdmin;
      socket.userId = user.id;
      socket.userTimezone = user.timezone || 'Europe/Stockholm';
      next();
    } catch (err) {
      next(new Error('auth-error'));
    }
  });

  _io.on('connection', (socket) => {
    const { tenantId, isAdmin } = socket;

    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
    }

    socket.on('join:machine', (machineId) => {
      if (machineId && tenantId) socket.join(`machine:${tenantId}:${machineId}`);
    });

    socket.on('leave:machine', (machineId) => {
      if (machineId && tenantId) socket.leave(`machine:${tenantId}:${machineId}`);
    });

    // SuperAdmin: join every active tenant room at once so live events from
    // all companies arrive on this socket.
    if (isAdmin) {
      socket.on('admin:join:all', async () => {
        try {
          const companies = await prisma.user.findMany({
            where: {
              deletedAt: null,
              status: 1,
              userRoles: { some: { role: { name: 'Company' } } },
            },
            select: { id: true },
          });
          for (const c of companies) socket.join(`tenant:${c.id}`);
          const tenantIds = companies.map((c) => c.id);
          socket.emit('admin:joined', { tenantIds });
        } catch (err) {
          console.error('[Socket.io] admin:join:all error:', err.message);
        }
      });

      // Per-tenant snapshot for the admin: returns current machine state for
      // one company without requiring a separate socket connection.
      socket.on('client:resync:tenant', async (data, callback) => {
        try {
          const targetTenantId = Number(data?.tenantId);
          if (!targetTenantId) {
            if (typeof callback === 'function') callback({ ok: false, error: 'tenantId required' });
            return;
          }
          const tenant = {
            tenantId: targetTenantId,
            schemaName: `tenant_${targetTenantId}`,
            dbName: null,
            timezone: socket.userTimezone,
          };
          const machines = await withTenant(tenant, (tx) =>
            tx.$queryRawUnsafe(
              `SELECT id AS "machineId", running_status AS "runningStatus",
                      unit_connected AS "unitConnected", last_online AS "lastOnline",
                      equipment_id AS "equipmentId"
                 FROM machines ORDER BY id`,
            ),
          );
          if (typeof callback === 'function') callback({ machines });
        } catch (err) {
          console.error('[Socket.io] client:resync:tenant error:', err.message);
          if (typeof callback === 'function') callback({ ok: false, error: err.message });
        }
      });
    }

    socket.on('client:resync', async (data, callback) => {
      try {
        // Admin without a specific tenantId uses admin:join:all + per-company
        // snapshot requests instead of a global resync.
        if (isAdmin && !tenantId) {
          if (typeof callback === 'function') callback({ ok: true });
          return;
        }

        const lastSeenTs = data?.lastSeenTs ? new Date(data.lastSeenTs) : null;
        const tenant = {
          tenantId,
          schemaName: `tenant_${tenantId}`,
          dbName: null,
          timezone: socket.userTimezone,
        };

        const snapshot = await withTenant(tenant, async (tx) => {
          const machines = await tx.$queryRawUnsafe(
            `SELECT id AS "machineId", running_status AS "runningStatus",
                    unit_connected AS "unitConnected", last_online AS "lastOnline",
                    equipment_id AS "equipmentId"
               FROM machines ORDER BY id`,
          );

          let recentStops = [];
          if (lastSeenTs) {
            recentStops = await tx.$queryRawUnsafe(
              `SELECT id, machine_id AS "machineId", start_time AS "startTime",
                      end_time AS "endTime", production_time AS "productionTime"
                 FROM machine_data
                WHERE start_time >= $1::timestamptz
                ORDER BY start_time DESC LIMIT 200`,
              lastSeenTs.toISOString(),
            );
          }

          return { machines, recentStops };
        });

        socket.emit('resync:snapshot', { ...snapshot, ts: Date.now() });
        if (typeof callback === 'function') callback({ ok: true });
      } catch (err) {
        console.error('[Socket.io] resync error:', err.message);
        if (typeof callback === 'function') callback({ ok: false, error: err.message });
      }
    });
  });

  // Public token-scoped namespace for Andon TV boards (Sprint 4 / Task 3).
  initAndonNamespace(_io);

  console.log('[Socket.io] Server initialised');
  return _io;
}

function emitToTenant(tenantId, event, data) {
  _io?.to(`tenant:${tenantId}`).emit(event, { ...data, tenantId });
}

function emitToMachine(tenantId, machineId, event, data) {
  _io?.to(`machine:${tenantId}:${machineId}`).emit(event, { ...data, tenantId });
  // Mirror the change to any Andon board watching a flow with this machine.
  // Fire-and-forget — never block or throw on the live machine-event path.
  relayMachineToAndon(tenantId, machineId).catch(() => {});
}

function getIo() {
  return _io;
}

module.exports = { init, emitToTenant, emitToMachine, getIo };
