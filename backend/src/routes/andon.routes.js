'use strict';
const { Router } = require('express');
const andonSvc = require('../services/andon.service');
const tokenSvc = require('../services/andon-tokens.service');
const { loadCompanyUserByEmail, buildTenantForCompanyUser } = require('../middleware/iot-auth');

const router = Router();

/** Build a minimal tenant object from a company (tenant) id. */
function tenantFromCompanyId(companyId) {
  return {
    tenantId: Number(companyId),
    schemaName: `tenant_${Number(companyId)}`,
    dbName: null,
    timezone: 'Europe/Stockholm',
  };
}

/**
 * PUBLIC Andon board endpoint — no JWT (intended for wall-mounted TVs).
 *
 * Tenant resolution (flow_id is only unique within a tenant schema):
 *   • PREFERRED — `?token=<cuid>`: a signed board token (Sprint 3 / Task 1).
 *     Resolves tenant + the token's flowId; the path flowId must match.
 *   • FALLBACK — `?company=<company-email>`: legacy/back-compat tenant key.
 *
 * @swagger
 * /api/v1/andon/{flowId}:
 *   get:
 *     tags: ["Andon (public)"]
 *     summary: Live Andon board data for a flow (no auth)
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: token
 *         description: Andon board token (preferred). Resolves tenant + flow.
 *         schema: { type: string }
 *       - in: query
 *         name: company
 *         description: Company-role email (fallback tenant key) if no token.
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Missing token/company }
 *       403: { description: Token does not match this flow }
 */
router.get('/:flowId', async (req, res, next) => {
  try {
    const flowId = Number(req.params.flowId);
    if (!flowId) return res.status(400).json({ error: 'flowId required' });

    const token = String(req.query.token ?? '').trim();
    const email = String(req.query.company ?? '').trim();

    let tenant;
    if (token) {
      const resolved = await tokenSvc.resolveToken(token);
      if (!resolved) return res.status(400).json({ error: 'invalid or expired token' });
      if (resolved.flowId !== flowId) {
        return res.status(403).json({ error: 'token does not match this flow' });
      }
      tenant = tenantFromCompanyId(resolved.companyId);
    } else if (email) {
      const companyUser = await loadCompanyUserByEmail(email);
      if (!companyUser) return res.status(400).json({ error: 'unknown company' });
      tenant = buildTenantForCompanyUser(companyUser);
    } else {
      return res.status(400).json({ error: 'token (or company) query param required' });
    }

    const data = await andonSvc.getAndon(tenant, flowId);
    // Short cache so a wall of TVs polling every 5s doesn't hammer the DB.
    res.set('Cache-Control', 'public, max-age=3');
    res.json(data);
  } catch (e) { next(e); }
});

module.exports = router;
