'use strict';

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/requirePermission');
const svc = require('../services/admin-types.service');

const router = Router();
router.use(tenantMiddleware, requirePermission('manage-types'));

router.get('/', async (req, res, next) => {
  try {
    const q = {
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.perPage ? Number(req.query.perPage) : undefined,
      search: req.query.search,
      name: req.query.name,
      entity: req.query.entity,
      isActive: req.query.isActive !== undefined
        ? (req.query.isActive === 'true' || req.query.isActive === '1' || req.query.isActive === true)
        : undefined,
      sort: req.query.sort,
      order: req.query.order,
    };
    res.json(await svc.list(req.tenant, q));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.findOne(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.tenant, req.body)); } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try { res.json(await svc.update(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try { await svc.softDelete(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
