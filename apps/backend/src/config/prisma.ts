import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ PostgreSQL connected successfully via Prisma');
    return true;
  } catch (error: any) {
    logger.error('❌ Failed to connect to PostgreSQL:', { error: error.message });
    return false;
  }
}
