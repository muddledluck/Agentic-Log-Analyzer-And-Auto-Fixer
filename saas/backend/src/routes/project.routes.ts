import { Router } from 'express';
import { getProjects, createProject } from '../controllers/project.controller';
import { createApiKey } from '../controllers/apiKey.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth); // Protect all project routes

router.get('/', getProjects);
router.post('/', createProject);
router.post('/:id/api-keys', createApiKey);

export default router;
