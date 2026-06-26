'use strict';
const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/andon-tokens.service');

const router = Router();
router.use(tenantMiddleware);

// Public base URL embedded in generated TV links. Override per environment.
const PUBLIC_BASE = (process.env.PUBLIC_APP_URL || 'https://app.fpanalyzer.se').replace(/\/$/, '');

function withUrl(t) {
  return { ...t, url: `${PUBLIC_BASE}/andon/${t.flowId}?token=${t.token}` };
}

/**
 * @swagger
 * /api/v1/admin/andon-tokens:
 *   get: { tags: ["Admin — Andon"], summary: List TV-board tokens for this company, security: [{ access_token: [] }], responses: { 200: { description: OK } } }
 *   post: { tags: ["Admin — Andon"], summary: Create a TV-board token, security: [{ access_token: [] }], responses: { 201: { description: Created } } }
 */
router.get('/', async (req, res, next) => {
  try {
    const tokens = await svc.listTokens(req.tenant.tenantId);
    res.json(tokens.map(withUrl));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const flowId = Number(req.body.flowId ?? req.body.flow_id);
    if (!flowId) return res.status(400).json({ error: 'flowId required' });
    const created = await svc.createToken(req.tenant.tenantId, {
      flowId, label: req.body.label, expiresAt: req.body.expiresAt,
    });
    res.status(201).json(withUrl(created));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/andon-tokens/{id}:
 *   delete: { tags: ["Admin — Andon"], summary: Revoke a TV-board token, security: [{ access_token: [] }], responses: { 200: { description: OK } } }
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const ok = await svc.revokeToken(req.tenant.tenantId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'not found' });
    res.json({ revoked: true });
  } catch (e) { next(e); }
});

module.exports = router;
