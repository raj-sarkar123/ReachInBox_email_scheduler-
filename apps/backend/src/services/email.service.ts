import { prisma } from '../config/prisma.js';
import { elasticsearchService } from '../integrations/elasticsearch/elasticsearch.service.js';
import { EmailStatus } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class EmailService {
  async getScheduledEmails(userId: string, limit = 100, offset = 0) {
    return prisma.email.findMany({
      where: {
        userId,
        status: { in: ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED_RESCHEDULED'] },
      },
      include: { sender: true },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      skip: offset,
    });
  }

  async getSentEmails(userId: string, limit = 100, offset = 0) {
    return prisma.email.findMany({
      where: {
        userId,
        status: { in: ['SENT', 'FAILED'] },
      },
      include: { sender: true },
      orderBy: { sentAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getEmailById(emailId: string, userId: string) {
    return prisma.email.findFirst({
      where: { id: emailId, userId },
      include: { sender: true, campaign: true },
    });
  }

  async getCounts(userId: string) {
    const [scheduled, sent] = await Promise.all([
      prisma.email.count({
        where: {
          userId,
          status: { in: ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED_RESCHEDULED'] },
        },
      }),
      prisma.email.count({
        where: {
          userId,
          status: { in: ['SENT', 'FAILED'] },
        },
      }),
    ]);

    return { scheduled, sent };
  }

  async searchEmails(userId: string, query: string, status?: EmailStatus) {
    if (!query || query.trim().length === 0) {
      if (status) {
        return prisma.email.findMany({
          where: { userId, status },
          include: { sender: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
      }
      return prisma.email.findMany({
        where: { userId },
        include: { sender: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }

    // 1. Try Elasticsearch first
    const esResult = await elasticsearchService.searchEmails({
      userId,
      query,
      status,
      limit: 50,
    });

    if (esResult.isElasticsearch && esResult.ids.length > 0) {
      logger.info(`🔍 Elasticsearch matched ${esResult.ids.length} emails for query '${query}'`);
      const emails = await prisma.email.findMany({
        where: { id: { in: esResult.ids }, userId },
        include: { sender: true },
      });

      // Preserve Elasticsearch relevance ranking order
      const idMap = new Map(emails.map((e) => [e.id, e]));
      return esResult.ids.map((id) => idMap.get(id)).filter(Boolean);
    }

    // 2. Resilient Database Fallback (if ES offline or returned 0 hits)
    logger.info(`🔍 Searching via PostgreSQL fallback for query '${query}'`);
    return prisma.email.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
        OR: [
          { recipient: { contains: query, mode: 'insensitive' } },
          { subject: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

export const emailDataService = new EmailService();
