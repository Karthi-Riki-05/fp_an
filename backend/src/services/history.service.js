'use strict';

const { prisma } = require('../prisma/client');

/**
 * Record an audit event.
 *
 * D6 spec: userId = actor.id (JWT sub — the user whose session performed the
 * action). When impersonating, impersonatorId = the original Super Admin's id.
 * Both ids are stored so the history feed can show "Admin acted as User".
 */
async function record({ actor, typeName, entityId, text, icon, cssClass }) {
  try {
    const typeId = await resolveTypeId(typeName);
    const impersonatorId = actor.impersonatorId ?? null;

    const baseText = impersonatorId
      ? `[impersonating ${actor.id} as su=${impersonatorId}] ${text}`
      : text;

    await prisma.history.create({
      data: {
        typeId,
        userId: actor.id,
        impersonatorId,
        entityId: entityId ?? undefined,
        text: baseText.slice(0, 255),
        icon: icon ?? null,
        class: cssClass ?? null,
      },
    });
  } catch (err) {
    console.warn(`history.record failed: ${err.message}`);
  }
}

async function resolveTypeId(name) {
  const existing = await prisma.historyType.findFirst({ where: { name }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.historyType.create({ data: { name } });
  return created.id;
}

module.exports = { record };
