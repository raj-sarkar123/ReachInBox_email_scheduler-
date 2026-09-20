import { prisma } from '../config/prisma.js';
import { addEmailJobToQueue } from '../queues/email.queue.js';
import { elasticsearchService } from '../integrations/elasticsearch/elasticsearch.service.js';
import { CreateCampaignDTO } from '../types/index.js';
import { logger } from '../utils/logger.js';

// RFC 5322 compliant regex for basic email validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function extractValidEmails(rawRecipients: string[]): { valid: string[]; invalid: string[] } {
  const validSet = new Set<string>();
  const invalidSet = new Set<string>();

  for (const raw of rawRecipients) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) continue;
    if (EMAIL_REGEX.test(trimmed)) {
      validSet.add(trimmed);
    } else {
      invalidSet.add(trimmed);
    }
  }

  return {
    valid: Array.from(validSet),
    invalid: Array.from(invalidSet),
  };
}

export class CampaignService {
  async createAndScheduleCampaign(userId: string, data: CreateCampaignDTO) {
    const { valid, invalid } = extractValidEmails(data.recipients);

    if (valid.length === 0) {
      throw new Error('No valid email recipients provided.');
    }

    // Verify sender exists and belongs to user
    const sender = await prisma.sender.findFirst({
      where: { id: data.senderId, userId },
    });

    if (!sender) {
      throw new Error('Selected sender not found or not owned by current user.');
    }

    const startTime = data.startTime ? new Date(data.startTime) : new Date();
    const delaySeconds = data.delaySeconds ?? sender.delaySeconds ?? 2;
    const hourlyLimit = data.hourlyLimit ?? sender.hourlyLimit ?? 100;

    // 1. Create Campaign record in PostgreSQL
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        senderId: sender.id,
        subject: data.subject,
        body: data.body,
        startTime,
        delaySeconds,
        hourlyLimit,
        status: 'SCHEDULED',
        totalRecipients: valid.length,
      },
    });

    logger.info('📋 Created campaign record', { campaignId: campaign.id, recipientsCount: valid.length });

    const now = Date.now();
    const baseStartTimeMs = startTime.getTime();
    const scheduledEmailIds: string[] = [];

    // 2. Create individual Email records and schedule BullMQ delayed jobs
    for (let i = 0; i < valid.length; i++) {
      const recipient = valid[i];
      // Calculate scheduled time with inter-email delay offset
      const scheduledTimestampMs = baseStartTimeMs + i * (delaySeconds * 1000);
      const scheduledAt = new Date(scheduledTimestampMs);
      const delayMs = Math.max(0, scheduledTimestampMs - now);

      const idempotencyKey = `campaign_${campaign.id}_recipient_${recipient}`;

      // Insert Email in PostgreSQL
      const emailRecord = await prisma.email.create({
        data: {
          campaignId: campaign.id,
          senderId: sender.id,
          userId,
          recipient,
          subject: data.subject,
          body: data.body,
          scheduledAt,
          status: 'SCHEDULED',
          idempotencyKey,
        },
      });

      // Add to BullMQ delayed queue (Strictly no cron)
      const jobId = await addEmailJobToQueue(
        {
          emailId: emailRecord.id,
          campaignId: campaign.id,
          senderId: sender.id,
          userId,
          recipient,
          scheduledAt: scheduledAt.toISOString(),
          idempotencyKey,
        },
        delayMs
      );

      // Store BullMQ job ID on email record
      await prisma.email.update({
        where: { id: emailRecord.id },
        data: { bullmqJobId: jobId },
      });

      // Index in Elasticsearch as SCHEDULED
      await elasticsearchService.indexEmail({
        id: emailRecord.id,
        userId: emailRecord.userId,
        senderId: emailRecord.senderId,
        recipient: emailRecord.recipient,
        subject: emailRecord.subject,
        body: emailRecord.body,
        status: 'SCHEDULED',
        scheduledAt: scheduledAt.toISOString(),
        createdAt: emailRecord.createdAt.toISOString(),
      });

      scheduledEmailIds.push(emailRecord.id);
    }

    return {
      campaign,
      totalScheduled: valid.length,
      invalidCount: invalid.length,
      invalidRecipients: invalid,
      firstScheduledAt: new Date(baseStartTimeMs),
      lastScheduledAt: new Date(baseStartTimeMs + (valid.length - 1) * (delaySeconds * 1000)),
    };
  }

  async getCampaignsByUser(userId: string) {
    return prisma.campaign.findMany({
      where: { userId },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCampaignById(campaignId: string, userId: string) {
    return prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        sender: true,
        emails: {
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });
  }
}

export const campaignService = new CampaignService();
