import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { config } from '../config/index.js';
import { GoogleUserProfile } from '../integrations/google/google-auth.service.js';
import { AuthUser } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class AuthService {
  generateToken(user: AuthUser): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      config.jwt.secret,
      { expiresIn: '7d' }
    );
  }

  verifyToken(token: string): AuthUser | null {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      return {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
      };
    } catch (err) {
      return null;
    }
  }

  async handleGoogleUser(googleProfile: GoogleUserProfile): Promise<{ user: AuthUser; token: string }> {
    // Upsert User
    const user = await prisma.user.upsert({
      where: { email: googleProfile.email },
      update: {
        googleId: googleProfile.googleId,
        name: googleProfile.name,
        avatar: googleProfile.avatar,
      },
      create: {
        googleId: googleProfile.googleId,
        email: googleProfile.email,
        name: googleProfile.name,
        avatar: googleProfile.avatar,
      },
    });

    // Ensure user has at least one default sender profile
    const existingSender = await prisma.sender.findFirst({
      where: { userId: user.id },
    });

    if (!existingSender) {
      await prisma.sender.create({
        data: {
          userId: user.id,
          email: user.email,
          name: user.name,
          smtpHost: 'smtp.ethereal.email',
          smtpPort: 587,
          hourlyLimit: 100,
          delaySeconds: 2,
        },
      });
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };

    const token = this.generateToken(authUser);
    logger.info('👤 User authenticated via Google OAuth', { email: user.email });

    return { user: authUser, token };
  }

  async getOrCreateDemoUser(): Promise<{ user: AuthUser; token: string }> {
    const user = await prisma.user.upsert({
      where: { email: 'oliver.brown@domain.io' },
      update: {},
      create: {
        id: 'a0000000-0000-0000-0000-000000000001',
        googleId: 'google-oauth-demo-12345',
        name: 'Oliver Brown',
        email: 'oliver.brown@domain.io',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
      },
    });

    // Ensure sender exists
    const sender = await prisma.sender.findFirst({
      where: { userId: user.id },
    });

    if (!sender) {
      await prisma.sender.create({
        data: {
          id: 'b0000000-0000-0000-0000-000000000001',
          userId: user.id,
          email: 'oliver.brown@domain.io',
          name: 'Oliver Brown',
          smtpHost: 'smtp.ethereal.email',
          smtpPort: 587,
          hourlyLimit: 100,
          delaySeconds: 2,
        },
      });
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };

    const token = this.generateToken(authUser);
    return { user: authUser, token };
  }
}

export const authService = new AuthService();
