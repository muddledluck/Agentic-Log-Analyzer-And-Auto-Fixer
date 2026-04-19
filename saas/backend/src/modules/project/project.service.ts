import prisma from '../../shared/utils/prisma';
import { NotFoundError } from '../../shared/errors/AppError';

export class ProjectService {
  static async getProjects(organizationId: string) {
    return prisma.project.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async createProject(name: string, organizationId: string) {
    return prisma.project.create({
      data: {
        name,
        organizationId,
      },
    });
  }

  /** Ensures the project belongs to the organization; throws NotFoundError otherwise. */
  static async assertProjectInOrganization(
    projectId: string,
    organizationId: string,
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return project;
  }

  static async listErrorEvents(
    projectId: string,
    organizationId: string,
    limit: number,
    offset: number,
  ) {
    await this.assertProjectInOrganization(projectId, organizationId);

    const where = { projectId };

    const [events, total] = await Promise.all([
      prisma.errorEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          projectId: true,
          rawMessage: true,
          contextLines: true,
          timestamp: true,
          status: true,
          report: {
            select: { id: true, createdAt: true },
          },
        },
      }),
      prisma.errorEvent.count({ where }),
    ]);

    return { events, total, limit, offset };
  }

  static async getErrorEventReport(
    projectId: string,
    eventId: string,
    organizationId: string,
  ) {
    await this.assertProjectInOrganization(projectId, organizationId);

    const event = await prisma.errorEvent.findFirst({
      where: { id: eventId, projectId },
      select: {
        id: true,
        status: true,
        timestamp: true,
        report: {
          select: { markdownBody: true, createdAt: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundError('Error event not found');
    }

    return {
      errorEventId: event.id,
      status: event.status,
      timestamp: event.timestamp,
      report: event.report
        ? {
            markdownBody: event.report.markdownBody,
            createdAt: event.report.createdAt,
          }
        : null,
    };
  }
}
