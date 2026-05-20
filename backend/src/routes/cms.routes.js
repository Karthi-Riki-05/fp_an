'use strict';

const { Router } = require('express');
const multer = require('multer');
const { requirePermission } = require('../middleware/requirePermission');
const { BadRequestError } = require('../errors');
const svc = require('../services/cms.service');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
router.use(requirePermission('manage-cms'));

/**
 * @swagger
 * /api/v1/cms:
 *   get:
 *     tags: ["Cms"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try {
    const q = { page: req.query.page ? Number(req.query.page) : undefined, perPage: req.query.perPage ? Number(req.query.perPage) : undefined, search: req.query.search };
    res.json(await svc.list(q));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/cms/{id}:
 *   get:
 *     tags: ["Cms"]
 *     summary: GET /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.findOne(Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/cms:
 *   post:
 *     tags: ["Cms"]
 *     summary: POST /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/', async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.user, req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/cms/{id}:
 *   patch:
 *     tags: ["Cms"]
 *     summary: PATCH /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id', async (req, res, next) => {
  try { res.json(await svc.update(req.user, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/cms/{id}:
 *   delete:
 *     tags: ["Cms"]
 *     summary: DELETE /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id', async (req, res, next) => {
  try { await svc.softDelete(req.user, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/cms/{id}/images:
 *   get:
 *     tags: ["Cms"]
 *     summary: GET /:id/images
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/images', async (req, res, next) => {
  try { res.json(await svc.listImages(Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/cms/{id}/images:
 *   post:
 *     tags: ["Cms"]
 *     summary: POST /:id/images
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/:id/images', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw new BadRequestError('image-file-required');
    res.status(201).json(await svc.addImage(req.user, Number(req.params.id), req.file, req.body.alt));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/cms/{id}/images/{imageId}:
 *   delete:
 *     tags: ["Cms"]
 *     summary: DELETE /:id/images/:imageId
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: imageId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id/images/:imageId', async (req, res, next) => {
  try { await svc.removeImage(req.user, Number(req.params.id), Number(req.params.imageId)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
