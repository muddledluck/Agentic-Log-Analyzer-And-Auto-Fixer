import crypto from 'crypto';
import prisma from '../../shared/utils/prisma';
import { NotFoundError } from '../../shared/errors/AppError';

export class ApiKeyService {
  static async createApiKey(projectId: string, organizationId: string) {
    // Verify project belongs to user's organization
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Generate secure key
    const rawValue = crypto.randomBytes(32).toString('hex');
    const rawKey = `alaa_${rawValue}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const partialKey = `alaa_...${rawKey.slice(-4)}`;

    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        partialKey,
        projectId,
      },
    });

    return { apiKey, rawKey };
  }
}
