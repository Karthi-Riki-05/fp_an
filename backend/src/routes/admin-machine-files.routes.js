'use strict';

const { Router } = require('express');
const multer = require('multer');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/admin-machine-files.service');

const router = Router();
router.use(tenantMiddleware);

// In-memory upload (small files) — FileStorageService picks up `req.file.buffer`.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * @swagger
 * /api/v1/admin/machine-files:
 *   get:
 *     tags: ["Admin — Machine Files"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try { res.json(await svc.list(req.tenant, { machineId: req.query.machineId })); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/machine-files/upload:
 *   post:
 *     tags: ["Admin — Machine Files"]
 *     summary: POST /upload
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    res.status(201).json(await svc.upload(req.tenant, req.user, req.body, req.file));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/machine-files/{id}:
 *   patch:
 *     tags: ["Admin — Machine Files"]
 *     summary: PATCH /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id', async (req, res, next) => {
  try { res.json(await svc.update(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/machine-files/{id}:
 *   delete:
 *     tags: ["Admin — Machine Files"]
 *     summary: DELETE /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id', async (req, res, next) => {
  try { await svc.softDelete(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
