'use strict';

const { Router } = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const svc = require('../services/tenants.service');

const router = Router();
const guard = requirePermission('manage-tenants');

router.get('/', guard, async (req, res, next) => {
  try { res.json(await svc.list()); } catch (err) { next(err); }
});

router.get('/:id', guard, async (req, res, next) => {
  try { res.json(await svc.findOneOrThrow(Number(req.params.id))); } catch (err) { next(err); }
});

router.post('/', guard, async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.user, req.body)); } catch (err) { next(err); }
});

router.patch('/:id', guard, async (req, res, next) => {
  try { res.json(await svc.update(req.user, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

router.patch('/:id/status', guard, async (req, res, next) => {
  try { res.json(await svc.setStatus(req.user, Number(req.params.id), req.body.status)); } catch (err) { next(err); }
});

router.delete('/:id', guard, async (req, res, next) => {
  try { await svc.archive(req.user, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

// users sub-resource
router.get('/:id/users', guard, async (req, res, next) => {
  try {
    const q = { page: req.query.page ? Number(req.query.page) : undefined, perPage: req.query.perPage ? Number(req.query.perPage) : undefined };
    res.json(await svc.listUsers(Number(req.params.id), q));
  } catch (err) { next(err); }
});

router.post('/:id/users', guard, async (req, res, next) => {
  try { res.status(201).json(await svc.addUser(req.user, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

router.delete('/:id/users/:userId', guard, async (req, res, next) => {
  try { await svc.removeUser(req.user, Number(req.params.id), Number(req.params.userId)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
