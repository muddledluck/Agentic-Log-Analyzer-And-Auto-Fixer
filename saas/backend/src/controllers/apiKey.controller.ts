import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../utils/prisma';

export const createApiKey = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projectId = req.params.id as string;

    if (!projectId) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    // Verify project belongs to user's organization
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: req.user.organizationId,
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
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

    res.status(201).json({
      message: 'API Key created successfully. This is the only time you will see the full key. Save it securely.',
      apiKey: {
        id: apiKey.id,
        partialKey: apiKey.partialKey,
        createdAt: apiKey.createdAt,
      },
      rawKey,
    });
  } catch (error) {
    console.error('Create API Key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
