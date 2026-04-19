import { Request, Response } from 'express';
import { catchAsync } from "../../shared/utils/catchAsync";
import {
  BadRequestError,
  UnauthorizedError,
} from "../../shared/errors/AppError";
import { ProjectService } from "./project.service";
import { listEventsQuerySchema } from "./project.schemas";

export const getProjects = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Unauthorized");
  }

  const projects = await ProjectService.getProjects(req.user.organizationId);

  res.status(200).json({ projects });
});

export const createProject = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Unauthorized");
  }

  const { name } = req.body;

  const project = await ProjectService.createProject(
    name,
    req.user.organizationId,
  );

  res.status(201).json({ message: "Project created successfully", project });
});

export const listProjectErrorEvents = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError("Unauthorized");
    }

    const projectId = req.params.id as string;
    const parsed = listEventsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join(", ");
      throw new BadRequestError(`Invalid query: ${msg}`);
    }

    const { limit, offset } = parsed.data;
    const result = await ProjectService.listErrorEvents(
      projectId,
      req.user.organizationId,
      limit,
      offset,
    );

    res.status(200).json(result);
  },
);

export const getProjectErrorEventReport = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError("Unauthorized");
    }

    const projectId = req.params.id as string;
    const eventId = req.params.eventId as string;

    const payload = await ProjectService.getErrorEventReport(
      projectId,
      eventId,
      req.user.organizationId,
    );

    res.status(200).json(payload);
  },
);
