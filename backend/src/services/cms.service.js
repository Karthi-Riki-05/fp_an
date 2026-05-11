'use strict';

const { prisma } = require('../prisma/client');
const { record } = require('./history.service');
const { put } = require('./file-storage.service');
const { ConflictError, NotFoundError } = require('../errors');
const { Prisma } = require('@prisma/client');

async function list(q) {
  const page = q.page ?? 1; const perPage = q.perPage ?? 50;
  const where = { deletedAt: null };
  if (q.search) where.OR = [{ title: { contains: q.search, mode: 'insensitive' } }, { slug: { contains: q.search, mode: 'insensitive' } }];
  const [data, total] = await prisma.$transaction([
    prisma.cms.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
    prisma.cms.count({ where }),
  ]);
  return { data, total, page, perPage };
}

async function findOne(id) {
  const row = await prisma.cms.findFirst({ where: { id, deletedAt: null }, include: { images: { where: { deletedAt: null }, orderBy: { id: 'asc' } } } });
  if (!row) throw new NotFoundError('cms-not-found');
  return row;
}

async function create(actor, dto) {
  try {
    const row = await prisma.cms.create({ data: { slug: dto.slug, title: dto.title, content: dto.content ?? null, status: dto.status ?? true } });
    await record({ actor, typeName: 'Cms', entityId: row.id, text: `created cms "${row.title}"`, icon: 'file-text' });
    return row;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError('cms-slug-already-exists');
    throw err;
  }
}

async function update(actor, id, dto) {
  await findOne(id);
  const data = {};
  if (dto.title !== undefined) data.title = dto.title;
  if (dto.content !== undefined) data.content = dto.content;
  if (dto.status !== undefined) data.status = dto.status;
  const row = await prisma.cms.update({ where: { id }, data });
  await record({ actor, typeName: 'Cms', entityId: id, text: `updated cms "${row.title}"`, icon: 'file-text' });
  return row;
}

async function softDelete(actor, id) {
  const row = await findOne(id);
  await prisma.cms.update({ where: { id }, data: { deletedAt: new Date() } });
  await record({ actor, typeName: 'Cms', entityId: id, text: `deleted cms "${row.title}"`, icon: 'file-text' });
}

async function listImages(cmsId) {
  await findOne(cmsId);
  return prisma.cmsImage.findMany({ where: { cmsId, deletedAt: null }, orderBy: { id: 'asc' } });
}

async function addImage(actor, cmsId, file, alt) {
  await findOne(cmsId);
  const result = await put(`cms/${cmsId}`, file.originalname, file.buffer, file.mimetype);
  const img = await prisma.cmsImage.create({ data: { cmsId, path: result.url, alt: alt ?? null } });
  await record({ actor, typeName: 'Cms', entityId: cmsId, text: `uploaded image to cms ${cmsId}`, icon: 'image' });
  return img;
}

async function removeImage(actor, cmsId, imageId) {
  const img = await prisma.cmsImage.findFirst({ where: { id: imageId, cmsId, deletedAt: null } });
  if (!img) throw new NotFoundError('cms-image-not-found');
  await prisma.cmsImage.update({ where: { id: imageId }, data: { deletedAt: new Date() } });
  await record({ actor, typeName: 'Cms', entityId: cmsId, text: `removed image from cms ${cmsId}`, icon: 'image' });
}

module.exports = { list, findOne, create, update, softDelete, listImages, addImage, removeImage };
