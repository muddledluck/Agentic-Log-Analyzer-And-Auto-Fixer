import bcrypt from 'bcrypt';
import prisma from '../../shared/utils/prisma';
import { generateToken } from '../../shared/utils/jwt';
import { BadRequestError, UnauthorizedError } from '../../shared/errors/AppError';
import { RegisterInput, LoginInput } from './auth.schemas';

export class AuthService {
  static async register(data: RegisterInput) {
    const { email, password, organizationName } = data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new BadRequestError('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx: any) => {
      const org = await tx.organization.create({
        data: { name: organizationName },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          organizationId: org.id,
        },
      });

      return { user, org };
    });

    const token = generateToken({
      userId: result.user.id,
      organizationId: result.org.id,
    });

    return { token, result };
  }

  static async login(data: LoginInput) {
    const { email, password } = data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = generateToken({
      userId: user.id,
      organizationId: user.organizationId,
    });

    return { token, user };
  }
}
