import { Router } from 'express';
import { getProjects, createProject } from './project.controller';
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
