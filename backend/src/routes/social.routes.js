'use strict';

const { Router } = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const svc = require('../services/social.service');

const router = Router();
router.use(requirePermission('manage-social'));

router.get('/', async (req, res, next) => {
  try { res.json(await svc.list()); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.findOne(Number(req.params.id))); } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.user, req.body)); } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try { res.json(await svc.update(req.user, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

module.exports = router;
