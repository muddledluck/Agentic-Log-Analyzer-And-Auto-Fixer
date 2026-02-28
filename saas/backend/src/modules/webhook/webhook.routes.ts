import { Router } from 'express';
import { ingestError } from './webhook.controller';

const router = Router();

// Note: No JWT middleware here, this uses x-api-key header directly
router.post('/ingest', ingestError);

export default router;
