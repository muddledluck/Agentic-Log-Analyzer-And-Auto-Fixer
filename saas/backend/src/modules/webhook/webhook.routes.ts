import { Router } from 'express';
import { ingestError } from './webhook.controller';
import { validateRequest } from "../../shared/middlewares/validate.middleware";
import { ingestErrorSchema } from "./webhook.schemas";

const router = Router();

// Note: No JWT middleware here, this uses x-api-key header directly
/**
 * @openapi
 * /api/webhooks/ingest:
 *   post:
 *     summary: Ingest an error event from an external client
 *     tags: [Webhooks]
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rawBlock]
 *             properties:
 *               source:
 *                 type: string
 *               rawBlock:
 *                 type: string
 *               timestamp:
 *                 type: string
 *               contextLines:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       202:
 *         description: Accepted
 */
router.post("/ingest", validateRequest(ingestErrorSchema), ingestError);

export default router;
