import { PrismaClient, CampaignStatus, EmailStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with ReachInbox default data...');

  // 1. Create or upsert Demo User (Oliver Brown matching Figma design)
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

  console.log(`👤 User ready: ${user.name} (${user.email})`);

  // 2. Senders
  const sender1 = await prisma.sender.upsert({
    where: {
      uq_user_sender_email: {
        userId: user.id,
        email: 'oliver.brown@domain.io',
      },
    },
    update: {},
    create: {
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

  const sender2 = await prisma.sender.upsert({
    where: {
      uq_user_sender_email: {
        userId: user.id,
        email: 'growth@domain.io',
      },
    },
    update: {},
    create: {
      id: 'b0000000-0000-0000-0000-000000000002',
      userId: user.id,
      email: 'growth@domain.io',
      name: 'Outbox Growth Team',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      hourlyLimit: 50,
      delaySeconds: 5,
    },
  });

  console.log(`✉️ Senders ready: ${sender1.email}, ${sender2.email}`);

  // 3. Demo Completed Campaign
  const campaign = await prisma.campaign.upsert({
    where: { id: 'c0000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'c0000000-0000-0000-0000-000000000001',
      userId: user.id,
      senderId: sender1.id,
      subject: 'Re: Project Update',
      body: '<p>Hi Sarah,</p><p>Thanks for the rainbow forest. Looks good!</p>',
      startTime: new Date(Date.now() - 2 * 3600 * 1000),
      delaySeconds: 2,
      hourlyLimit: 100,
      status: CampaignStatus.COMPLETED,
      totalRecipients: 2,
      sentCount: 2,
      failedCount: 0,
    },
  });

  // 4. Demo Sent Emails
  await prisma.email.upsert({
    where: { idempotencyKey: 'campaign_c0000000-0000-0000-0000-000000000001_sarah.wilson@domain.com' },
    update: {},
    create: {
      id: 'd0000000-0000-0000-0000-000000000001',
      campaignId: campaign.id,
      senderId: sender1.id,
      userId: user.id,
      recipient: 'sarah.wilson@domain.com',
      subject: 'Re: Project Update',
      body: '<p>Hi Sarah,</p><p>Thanks for the rainbow forest. Looks good!</p>',
      scheduledAt: new Date(Date.now() - 2 * 3600 * 1000),
      sentAt: new Date(Date.now() - 2 * 3600 * 1000),
      status: EmailStatus.SENT,
      bullmqJobId: 'job-seed-sent-01',
      idempotencyKey: 'campaign_c0000000-0000-0000-0000-000000000001_sarah.wilson@domain.com',
      etherealPreviewUrl: 'https://ethereal.email/message/seed-preview-01',
    },
  });

  await prisma.email.upsert({
    where: { idempotencyKey: 'campaign_c0000000-0000-0000-0000-000000000001_support@domain.com' },
    update: {},
    create: {
      id: 'd0000000-0000-0000-0000-000000000002',
      campaignId: campaign.id,
      senderId: sender1.id,
      userId: user.id,
      recipient: 'support@domain.com',
      subject: 'Issue with login',
      body: '<p>I am having trouble logged in to the dashboard.</p>',
      scheduledAt: new Date(Date.now() - 3600 * 1000),
      sentAt: new Date(Date.now() - 3600 * 1000),
      status: EmailStatus.SENT,
      bullmqJobId: 'job-seed-sent-02',
      idempotencyKey: 'campaign_c0000000-0000-0000-0000-000000000001_support@domain.com',
      etherealPreviewUrl: 'https://ethereal.email/message/seed-preview-02',
    },
  });

  console.log('✅ Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
