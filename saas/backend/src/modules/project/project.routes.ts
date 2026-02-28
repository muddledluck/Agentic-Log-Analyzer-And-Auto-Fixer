import { Router } from 'express';
import { getProjects, createProject } from './project.controller';
import { createApiKey } from './apiKey.controller';
import { requireAuth } from '../../shared/middlewares/auth.middleware';

const router = Router();

router.use(requireAuth); // Protect all project routes

router.get('/', getProjects);
router.post('/', createProject);
router.post('/:id/api-keys', createApiKey);

export default router;
