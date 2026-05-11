'use strict';

const { Router } = require('express');
const multer = require('multer');
const { requirePermission } = require('../middleware/requirePermission');
const svc = require('../services/testimonials.service');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
router.use(requirePermission('manage-testimonials'));

router.get('/', async (req, res, next) => {
  try {
    const q = { page: req.query.page ? Number(req.query.page) : undefined, perPage: req.query.perPage ? Number(req.query.perPage) : undefined, search: req.query.search };
    res.json(await svc.list(q));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.findOne(Number(req.params.id))); } catch (err) { next(err); }
});

router.post('/', upload.single('image'), async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.user, req.body, req.file)); } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try { res.json(await svc.update(req.user, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

router.post('/:id/image', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ statusCode: 400, message: 'image-file-required' });
    res.json(await svc.replaceImage(req.user, Number(req.params.id), req.file));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try { await svc.remove(req.user, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
