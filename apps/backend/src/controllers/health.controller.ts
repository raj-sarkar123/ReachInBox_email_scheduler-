import { Request, Response } from 'express';
import { checkDatabaseConnection } from '../config/prisma.js';
import { checkRedisConnection } from '../queues/redis.js';
import { elasticsearchService } from '../integrations/elasticsearch/elasticsearch.service.js';

export const healthController = {
  check: async (req: Request, res: Response) => {
    const [dbHealthy, redisHealthy] = await Promise.all([
      checkDatabaseConnection(),
      checkRedisConnection(),
    ]);

    const esHealthy = elasticsearchService.getStatus();

    const isAllHealthy = dbHealthy && redisHealthy;

    res.status(isAllHealthy ? 200 : 503).json({
      status: isAllHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
        redis: redisHealthy ? 'connected' : 'disconnected',
        elasticsearch: esHealthy ? 'connected' : 'unavailable_or_starting',
      },
    });
  },
};
