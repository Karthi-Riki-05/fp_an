'use strict';

const { Router } = require('express');
const { requireRole } = require('../middleware/requireRole');
const svc = require('../services/admin-users.service');

const router = Router();
router.use(requireRole('Administrator'));

router.get('/users', async (req, res, next) => {
  try {
    const q = { page: req.query.page ? Number(req.query.page) : undefined, perPage: req.query.perPage ? Number(req.query.perPage) : undefined, search: req.query.search, name: req.query.name, email: req.query.email, confirmed: req.query.confirmed, active: req.query.active, sort: req.query.sort, order: req.query.order };
    res.json(await svc.listAll(q));
  } catch (err) { next(err); }
});

module.exports = router;
