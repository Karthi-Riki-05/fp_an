'use strict';

const { prisma } = require('../prisma/client');
const { record } = require('./history.service');
const { ConflictError, NotFoundError } = require('../errors');
const { Prisma } = require('@prisma/client');

const SOCIAL_TYPE = 'social';

function list() {
  return prisma.siteSetting.findMany({ where: { type: SOCIAL_TYPE }, orderBy: { id: 'asc' }, select: { id: true, varKey: true, varValue: true, status: true, updatedAt: true } });
}

async function findOne(id) {
  const row = await prisma.siteSetting.findFirst({ where: { id, type: SOCIAL_TYPE }, select: { id: true, varKey: true, varValue: true, status: true, updatedAt: true } });
  if (!row) throw new NotFoundError('social-not-found');
  return row;
}

async function create(actor, dto) {
  try {
    const row = await prisma.siteSetting.create({ data: { type: SOCIAL_TYPE, varKey: dto.varKey, varValue: dto.varValue ?? null, status: dto.status ?? true } });
    await record({ actor, typeName: 'Social', entityId: row.id, text: `added social link ${dto.varKey}`, icon: 'share' });
    return row;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError('social-key-already-exists');
    throw err;
  }
}

async function update(actor, id, dto) {
  const existing = await findOne(id);
  const data = {};
  if (dto.varValue !== undefined) data.varValue = dto.varValue;
  if (dto.status !== undefined) data.status = dto.status;
  if (Object.keys(data).length === 0) return existing;
  const row = await prisma.siteSetting.update({ where: { id }, data });
  await record({ actor, typeName: 'Social', entityId: id, text: `updated social link ${existing.varKey}`, icon: 'share' });
  return row;
}

module.exports = { list, findOne, create, update };
