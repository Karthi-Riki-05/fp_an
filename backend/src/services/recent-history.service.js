'use strict';

const { prisma } = require('../prisma/client');

/**
 * Cursor-based history feed — Section D3 / Section B.7.
 * Returns { items, next_cursor }.
 * next_cursor is the ISO timestamp of the oldest row returned; pass it as
 * `before` on the next call to get the preceding page.
 */
async function list(q) {
  const limit = Math.min(q.limit ?? 50, 200);
  const where = {};

  if (q.before) where.createdAt = { lt: new Date(q.before) };
  if (q.actorId) where.userId = Number(q.actorId);
  if (q.entityId) where.entityId = Number(q.entityId);
  if (q.entityType) where.type = { name: q.entityType };
  if (q.typeId) where.typeId = Number(q.typeId);
  if (q.typeName && !q.entityType) where.type = { name: q.typeName };

  const rows = await prisma.history.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: {
      type: { select: { name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const next_cursor = hasMore ? items[items.length - 1].createdAt?.toISOString() ?? null : null;

  return {
    items: items.map((r) => ({
      id: r.id,
      text: r.text,
      icon: r.icon ?? null,
      class: r.class ?? null,
      entityId: r.entityId ?? null,
      entityType: r.type.name,
      actorId: r.user.id,
      actorName: r.user.name,
      actorEmail: r.user.email,
      impersonatorId: r.impersonatorId ?? null,
      createdAt: r.createdAt,
    })),
    next_cursor,
  };
}

module.exports = { list };
