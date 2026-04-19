import prisma from '../../shared/utils/prisma';

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
}
