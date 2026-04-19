import { Request, Response } from 'express';
import { catchAsync } from "../../shared/utils/catchAsync";
import {
  BadRequestError,
  UnauthorizedError,
} from "../../shared/errors/AppError";
import { ProjectService } from "./project.service";

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
