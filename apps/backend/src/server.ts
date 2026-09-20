import { createApp } from './app.js';
import { config } from './config/index.js';
import { checkDatabaseConnection, prisma } from './config/prisma.js';
import { checkRedisConnection, redisConnection } from './queues/redis.js';
import { emailService } from './integrations/email/nodemailer.service.js';
import { elasticsearchService } from './integrations/elasticsearch/elasticsearch.service.js';
import { startEmailWorker } from './workers/email.worker.js';
import { emailQueue } from './queues/email.queue.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info('🚀 Starting ReachInbox Email Scheduler Backend Service...');

  // 1. Check Infrastructure Dependencies
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    logger.warn('⚠️ Database not reachable at start. Server will attempt reconnects.');
  }

  const redisConnected = await checkRedisConnection();
  if (!redisConnected) {
    logger.warn('⚠️ Redis not reachable at start. Queues will retry connection.');
  }

  // 2. Initialize Integrations
  try {
    await emailService.init();
  } catch (err: any) {
    logger.warn('⚠️ Nodemailer/Ethereal initialization deferred:', { error: err.message });
  }

  try {
    await elasticsearchService.initIndex();
  } catch (err: any) {
    logger.warn('⚠️ Elasticsearch initialization deferred:', { error: err.message });
  }

  // 3. Start BullMQ Email Worker
  const worker = startEmailWorker();

  // 4. Start HTTP Express Server
  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`=======================================================`);
    logger.info(`✅ Server listening on http://localhost:${config.port}`);
    logger.info(`📊 BullMQ Board UI: http://localhost:${config.port}/admin/queues`);
    logger.info(`🔍 API Health Check: http://localhost:${config.port}/api/health`);
    logger.info(`⚙️  Worker Concurrency: ${config.scheduler.workerConcurrency}`);
    logger.info(`⏱️  Min Delay Between Sends: ${config.scheduler.emailMinDelaySeconds}s`);
    logger.info(`=======================================================`);
  });

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await worker.close();
        await emailQueue.close();
        redisConnection.disconnect();
        await prisma.$disconnect();
        logger.info('Worker, queues, Redis and DB disconnected. Exit.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown:', { error: err });
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('💥 Fatal bootstrap error:', { error: err });
  process.exit(1);
});
