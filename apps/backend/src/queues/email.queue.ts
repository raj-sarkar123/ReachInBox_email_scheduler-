import { Queue } from 'bullmq';
import { redisConnection } from './redis.js';
import { EmailJobData } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false, // Retain for auditing & Bull Board visibility
    removeOnFail: false,
  },
});

export async function addEmailJobToQueue(jobData: EmailJobData, delayMs: number): Promise<string> {
  const jobId = `email_${jobData.emailId}`;
  
  await emailQueue.add('send-email', jobData, {
    jobId, // Deterministic ID prevents duplicate job creation across restarts
    delay: Math.max(0, delayMs),
  });

  logger.info('🕒 BullMQ delayed job queued', {
    jobId,
    emailId: jobData.emailId,
    delayMs,
    recipient: jobData.recipient,
  });

  return jobId;
}
