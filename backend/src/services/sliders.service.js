'use strict';

const { prisma } = require('../prisma/client');
const { record } = require('./history.service');
const { put } = require('./file-storage.service');
const { NotFoundError } = require('../errors');

async function list(q) {
  const page = q.page ?? 1; const perPage = q.perPage ?? 50;
  const where = {};
  if (q.search) where.OR = [{ title: { contains: q.search, mode: 'insensitive' } }, { description: { contains: q.search, mode: 'insensitive' } }];
  const [data, total] = await prisma.$transaction([
    prisma.slider.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], skip: (page - 1) * perPage, take: perPage }),
    prisma.slider.count({ where }),
  ]);
  return { data, total, page, perPage };
}

async function findOne(id) {
  const row = await prisma.slider.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('slider-not-found');
  return row;
}

async function create(actor, dto, file) {
  const result = await put('sliders', file.originalname, file.buffer, file.mimetype);
  const row = await prisma.slider.create({ data: { title: dto.title ?? null, description: dto.description ?? null, link: dto.link ?? null, status: dto.status ?? true, sortOrder: dto.sortOrder ?? 0, image: result.url } });
  await record({ actor, typeName: 'Slider', entityId: row.id, text: `created slider "${row.title ?? row.id}"`, icon: 'image' });
  return row;
}

async function update(actor, id, dto) {
  await findOne(id);
  const data = {};
  if (dto.title !== undefined) data.title = dto.title;
  if (dto.description !== undefined) data.description = dto.description;
  if (dto.link !== undefined) data.link = dto.link;
  if (dto.status !== undefined) data.status = dto.status;
  if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
  const row = await prisma.slider.update({ where: { id }, data });
  await record({ actor, typeName: 'Slider', entityId: id, text: `updated slider "${row.title ?? id}"`, icon: 'image' });
  return row;
}

async function replaceImage(actor, id, file) {
  await findOne(id);
  const result = await put('sliders', file.originalname, file.buffer, file.mimetype);
  const row = await prisma.slider.update({ where: { id }, data: { image: result.url } });
  await record({ actor, typeName: 'Slider', entityId: id, text: `replaced slider image (${row.title ?? id})`, icon: 'image' });
  return row;
}

async function remove(actor, id) {
  const row = await findOne(id);
  await prisma.slider.delete({ where: { id } });
  await record({ actor, typeName: 'Slider', entityId: id, text: `deleted slider "${row.title ?? id}"`, icon: 'image' });
}

module.exports = { list, findOne, create, update, replaceImage, remove };
