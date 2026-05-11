'use strict';

const { Router } = require('express');
const { requireRole } = require('../middleware/requireRole');
const svc = require('../services/recent-history.service');

const router = Router();
router.use(requireRole('Administrator'));

router.get('/', async (req, res, next) => {
  try {
    const q = {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      before: req.query.before,
      actorId: req.query.actor_id,
      entityId: req.query.entity_id,
      entityType: req.query.entity_type,
      typeId: req.query.typeId ? Number(req.query.typeId) : undefined,
      typeName: req.query.typeName,
    };
    res.json(await svc.list(q));
  } catch (err) { next(err); }
});

module.exports = router;
