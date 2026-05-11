'use strict';

const { Router } = require('express');
const { check } = require('../services/health.service');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const status = await check();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
