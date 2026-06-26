'use strict';

const { Router } = require('express');
const { requirePermission, requireAnyPermission } = require('../middleware/requirePermission');
const svc = require('../services/roles.service');

const router = Router();
// Writes require manage-roles. Reads are allowed for anyone who can view the
// backend (Company admins) so they get a READ-ONLY roles view (Sprint 4 /
// Task 5); the UI hides edit/delete unless the user is an Administrator.
// (Administrators bypass permission checks in requirePermission.)
const guard = requirePermission('manage-roles');
const viewGuard = requireAnyPermission('manage-roles', 'view-roles', 'view-backend');

/**
 * @swagger
 * /api/v1/admin/roles:
 *   get:
 *     tags: ["Roles"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', viewGuard, async (req, res, next) => {
  try { res.json(await svc.list()); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/roles/permissions:
 *   get:
 *     tags: ["Roles"]
 *     summary: GET /permissions
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/permissions', viewGuard, async (req, res, next) => {
  try { res.json(await svc.listPermissions()); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/roles/{id}:
 *   get:
 *     tags: ["Roles"]
 *     summary: GET /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id', viewGuard, async (req, res, next) => {
  try { res.json(await svc.findOne(Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/roles:
 *   post:
 *     tags: ["Roles"]
 *     summary: POST /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/', guard, async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.user, req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/roles/{id}:
 *   patch:
 *     tags: ["Roles"]
 *     summary: PATCH /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id', guard, async (req, res, next) => {
  try { res.json(await svc.update(req.user, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/roles/{id}:
 *   delete:
 *     tags: ["Roles"]
 *     summary: DELETE /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id', guard, async (req, res, next) => {
  try { await svc.remove(req.user, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
