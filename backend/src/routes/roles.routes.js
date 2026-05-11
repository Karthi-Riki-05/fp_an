'use strict';

const { Router } = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const svc = require('../services/roles.service');

const router = Router();
const guard = requirePermission('manage-roles');

router.get('/', guard, async (req, res, next) => {
  try { res.json(await svc.list()); } catch (err) { next(err); }
});

router.get('/permissions', guard, async (req, res, next) => {
  try { res.json(await svc.listPermissions()); } catch (err) { next(err); }
});

router.get('/:id', guard, async (req, res, next) => {
  try { res.json(await svc.findOne(Number(req.params.id))); } catch (err) { next(err); }
});

router.post('/', guard, async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.user, req.body)); } catch (err) { next(err); }
});

router.patch('/:id', guard, async (req, res, next) => {
  try { res.json(await svc.update(req.user, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

router.delete('/:id', guard, async (req, res, next) => {
  try { await svc.remove(req.user, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
