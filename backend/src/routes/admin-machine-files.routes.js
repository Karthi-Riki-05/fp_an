'use strict';

const { Router } = require('express');
const multer = require('multer');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/admin-machine-files.service');

const router = Router();
router.use(tenantMiddleware);

// In-memory upload (small files) — FileStorageService picks up `req.file.buffer`.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/', async (req, res, next) => {
  try { res.json(await svc.list(req.tenant, { machineId: req.query.machineId })); } catch (err) { next(err); }
});

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    res.status(201).json(await svc.upload(req.tenant, req.user, req.body, req.file));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try { res.json(await svc.update(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try { await svc.softDelete(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
