import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/redis.js';
import { EMAIL_QUEUE_NAME } from '../queues/email.queue.js';
import { EmailJobData } from '../types/index.js';
import { prisma } from '../config/prisma.js';
import { emailService } from '../integrations/email/nodemailer.service.js';
import { elasticsearchService } from '../integrations/elasticsearch/elasticsearch.service.js';
import { rateLimitService } from '../services/rate-limit.service.js';
import { slackService } from '../integrations/slack/slack.service.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export function startEmailWorker(): Worker<EmailJobData> {
  const concurrency = config.scheduler.workerConcurrency;

  logger.info(`👷 Starting BullMQ Email Worker with concurrency=${concurrency}...`);

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId, senderId, recipient, idempotencyKey, userId } = job.data;
      logger.info('🚀 Worker received email job', {
        jobId: job.id,
        emailId,
        recipient,
      });

      // 1. Fetch Email and Sender record from PostgreSQL
      const emailRecord = await prisma.email.findUnique({
        where: { id: emailId },
        include: { sender: true },
      });

      if (!emailRecord) {
        logger.warn('⚠️ Email record not found in database, discarding job', { emailId });
        return;
      }

      // 2. IDEMPOTENCY CHECK: Ensure already sent emails are never re-sent
      if (emailRecord.status === 'SENT') {
        logger.info('🛑 Email already marked as SENT. Skipping execution for idempotency.', {
          emailId,
          recipient,
        });
        return;
      }

      // 3. Atomically mark email as PROCESSING
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'PROCESSING' },
      });

      // 4. DISTRIBUTED RATE LIMIT CHECK (Redis Atomic Lua)
      const hourlyLimit = emailRecord.sender.hourlyLimit || config.scheduler.maxEmailsPerHourPerSender;
      const rateLimitResult = await rateLimitService.checkAndIncrement(senderId, hourlyLimit);

      if (!rateLimitResult.allowed) {
        const rescheduledTime = rateLimitResult.rescheduledTime || new Date(Date.now() + 3600000);
        const delayMs = rateLimitResult.delayMs || 3600000;

        logger.warn('⏳ Hourly rate limit reached for sender. Rescheduling job instead of failing.', {
          senderEmail: emailRecord.sender.email,
          hourlyLimit,
          rescheduledTime: rescheduledTime.toISOString(),
          delayMs,
        });

        // Update database status
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'RATE_LIMITED_RESCHEDULED',
            scheduledAt: rescheduledTime,
          },
        });

        // Send real Slack notification
        await slackService.sendRateLimitAlert({
          userId: emailRecord.userId,
          senderEmail: emailRecord.sender.email,
          hourlyLimit,
          rescheduledTime,
          recipient,
        });

        // Move job back to delayed state in BullMQ
        await job.moveToDelayed(Date.now() + delayMs, job.token);
        return;
      }

      // 5. INTER-EMAIL DELAY (Enforce minimum delay to mimic provider throttling)
      const minDelaySeconds = emailRecord.sender.delaySeconds || config.scheduler.emailMinDelaySeconds;
      if (minDelaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, minDelaySeconds * 1000));
      }

      // 6. SEND EMAIL VIA ETHEREAL SMTP
      try {
        const sendResult = await emailService.sendEmail({
          from: `"${emailRecord.sender.name}" <${emailRecord.sender.email}>`,
          to: emailRecord.recipient,
          subject: emailRecord.subject,
          html: emailRecord.body,
        });

        const sentAt = new Date();

        // 7. Update PostgreSQL status to SENT
        const updatedEmail = await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt,
            etherealMessageId: sendResult.messageId,
            etherealPreviewUrl: sendResult.previewUrl,
          },
        });

        // Update campaign counter
        await prisma.campaign.update({
          where: { id: emailRecord.campaignId },
          data: { sentCount: { increment: 1 } },
        });

        // 8. Index into Elasticsearch
        await elasticsearchService.indexEmail({
          id: updatedEmail.id,
          userId: updatedEmail.userId,
          senderId: updatedEmail.senderId,
          recipient: updatedEmail.recipient,
          subject: updatedEmail.subject,
          body: updatedEmail.body,
          status: 'SENT',
          scheduledAt: updatedEmail.scheduledAt.toISOString(),
          sentAt: sentAt.toISOString(),
          createdAt: updatedEmail.createdAt.toISOString(),
        });

        logger.info('🎉 Email job processed and sent successfully!', {
          emailId,
          recipient,
          previewUrl: sendResult.previewUrl,
        });
      } catch (sendError: any) {
        logger.error('❌ Failed to send email via SMTP:', {
          emailId,
          recipient,
          error: sendError.message,
        });

        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            failureReason: sendError.message,
          },
        });

        await prisma.campaign.update({
          where: { id: emailRecord.campaignId },
          data: { failedCount: { increment: 1 } },
        });

        throw sendError; // BullMQ will handle configured retries/backoff
      }
    },
    {
      connection: redisConnection,
      concurrency,
    }
  );

  worker.on('completed', (job) => {
    logger.info(`✨ BullMQ Job #${job.id} marked COMPLETED`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`💥 BullMQ Job #${job?.id} FAILED:`, { error: err.message });
  });

  return worker;
}
