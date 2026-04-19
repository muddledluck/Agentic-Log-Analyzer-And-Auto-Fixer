import { Router } from 'express';
import {
  getProjects,
  createProject,
  listProjectErrorEvents,
  getProjectErrorEventReport,
} from './project.controller';
import { createApiKey } from './apiKey.controller';
import { requireAuth } from '../../shared/middlewares/auth.middleware';
import { validateRequest } from "../../shared/middlewares/validate.middleware";
import { createProjectSchema } from "./project.schemas";

const router = Router();

router.use(requireAuth); // Protect all project routes

/**
 * @openapi
 * /api/projects:
 *   get:
 *     summary: List all projects for current user's organization
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', getProjects);

/**
 * @openapi
 * /api/projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Successfully created
 */
router.post("/", validateRequest(createProjectSchema), createProject);

/**
 * @openapi
 * /api/projects/{id}/events/{eventId}/report:
 *   get:
 *     summary: Get AI report for an error event (project must belong to your organization)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report payload (report may be null if still processing)
 */
router.get('/:id/events/:eventId/report', getProjectErrorEventReport);

/**
 * @openapi
 * /api/projects/{id}/events:
 *   get:
 *     summary: List error events for a project (newest first)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Paginated error events
 */
router.get('/:id/events', listProjectErrorEvents);

/**
 * @openapi
 * /api/projects/{id}/api-keys:
 *   post:
 *     summary: Create a new API Key for a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Successfully created API Key
 */
router.post('/:id/api-keys', createApiKey);

export default router;
