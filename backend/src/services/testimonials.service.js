'use strict';

const { prisma } = require('../prisma/client');
const { record } = require('./history.service');
const { put } = require('./file-storage.service');
const { NotFoundError } = require('../errors');

async function list(q) {
  const page = q.page ?? 1; const perPage = q.perPage ?? 50;
  const where = {};
  if (q.search) where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { companyName: { contains: q.search, mode: 'insensitive' } }, { title: { contains: q.search, mode: 'insensitive' } }];
  const [data, total] = await prisma.$transaction([
    prisma.testimonial.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], skip: (page - 1) * perPage, take: perPage }),
    prisma.testimonial.count({ where }),
  ]);
  return { data, total, page, perPage };
}

async function findOne(id) {
  const row = await prisma.testimonial.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('testimonial-not-found');
  return row;
}

async function create(actor, dto, file) {
  let image = null;
  if (file) {
    const result = await put('testimonials', file.originalname, file.buffer, file.mimetype);
    image = result.url;
  }
  const row = await prisma.testimonial.create({ data: { name: dto.name, companyName: dto.companyName, title: dto.title ?? null, role: dto.role ?? null, body: dto.body, image, status: dto.status ?? true, sortOrder: dto.sortOrder ?? 0 } });
  await record({ actor, typeName: 'Testimonial', entityId: row.id, text: `created testimonial "${row.name}"`, icon: 'comment' });
  return row;
}

async function update(actor, id, dto) {
  await findOne(id);
  const data = {};
  if (dto.name !== undefined) data.name = dto.name;
  if (dto.companyName !== undefined) data.companyName = dto.companyName;
  if (dto.title !== undefined) data.title = dto.title;
  if (dto.role !== undefined) data.role = dto.role;
  if (dto.body !== undefined) data.body = dto.body;
  if (dto.status !== undefined) data.status = dto.status;
  if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
  const row = await prisma.testimonial.update({ where: { id }, data });
  await record({ actor, typeName: 'Testimonial', entityId: id, text: `updated testimonial "${row.name}"`, icon: 'comment' });
  return row;
}

async function replaceImage(actor, id, file) {
  const old = await findOne(id);
  const result = await put('testimonials', file.originalname, file.buffer, file.mimetype);
  const row = await prisma.testimonial.update({ where: { id }, data: { image: result.url } });
  await record({ actor, typeName: 'Testimonial', entityId: id, text: `replaced testimonial image (${old.name})`, icon: 'comment' });
  return row;
}

async function remove(actor, id) {
  const row = await findOne(id);
  await prisma.testimonial.delete({ where: { id } });
  await record({ actor, typeName: 'Testimonial', entityId: id, text: `deleted testimonial "${row.name}"`, icon: 'comment' });
}

module.exports = { list, findOne, create, update, replaceImage, remove };
