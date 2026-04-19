import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../shared/utils/prisma';
import { catchAsync } from "../../shared/utils/catchAsync";
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
} from "../../shared/errors/AppError";

export const createApiKey = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Unauthorized");
  }

  const projectId = req.params.id as string;

  if (!projectId) {
    throw new BadRequestError("Project ID is required");
  }

  // Verify project belongs to user's organization
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: req.user.organizationId,
    },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  // Generate secure key
  const rawValue = crypto.randomBytes(32).toString("hex");
  const rawKey = `alaa_${rawValue}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const partialKey = `alaa_...${rawKey.slice(-4)}`;

  const apiKey = await prisma.apiKey.create({
    data: {
      keyHash,
      partialKey,
      projectId,
    },
  });

  res.status(201).json({
    message:
      "API Key created successfully. This is the only time you will see the full key. Save it securely.",
    apiKey: {
      id: apiKey.id,
      partialKey: apiKey.partialKey,
      createdAt: apiKey.createdAt,
    },
    rawKey,
  });
});
