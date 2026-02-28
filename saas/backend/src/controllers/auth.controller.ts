import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../utils/prisma';
import { generateToken } from '../utils/jwt';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, organizationName } = req.body;

    if (!email || !password || !organizationName) {
      res.status(400).json({ error: 'Email, password, and organizationName are required' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email is already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create the organization and user in a transaction
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

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: result.user.id, email: result.user.email },
      organization: result.org,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      organizationId: user.organizationId,
    });

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
