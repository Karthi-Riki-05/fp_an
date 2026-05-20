'use strict';

const { Router } = require('express');
const { requireRole } = require('../middleware/requireRole');
const svc = require('../services/admin-users.service');

const router = Router();
router.use(requireRole('Administrator'));

// GET /superadmin/users/:id — fetch a single user without requiring tenant context
router.get('/users/:id', async (req, res, next) => {
  try {
    res.json(await svc.findOneGlobal(Number(req.params.id)));
  } catch (err) { next(err); }
});

router.get('/users', async (req, res, next) => {
  try {
    const rawRoles = req.query.roles;
    const roles = Array.isArray(rawRoles)
      ? rawRoles
      : typeof rawRoles === 'string' && rawRoles.length
        ? rawRoles.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;
    const q = {
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.perPage ? Number(req.query.perPage) : undefined,
      search: req.query.search,
      name: req.query.name,
      email: req.query.email,
      confirmed: req.query.confirmed,
      active: req.query.active,
      deleted: req.query.deleted, // 'true' → show soft-deleted rows
      roles,
      sort: req.query.sort,
      order: req.query.order,
    };
    res.json(await svc.listAll(q));
  } catch (err) { next(err); }
});

module.exports = router;
