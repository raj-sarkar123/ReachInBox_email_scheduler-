-- ===================================================
-- REACHINBOX EMAIL SCHEDULER - DATABASE SEED DATA
-- Default Demo User: Oliver Brown (matches Figma design)
-- ===================================================

-- 1. Insert Demo User (Oliver Brown)
INSERT INTO users (id, google_id, name, email, avatar, created_at, updated_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'google-oauth-demo-12345',
    'Oliver Brown',
    'oliver.brown@domain.io',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. Insert Default Senders for Oliver Brown
INSERT INTO senders (id, user_id, email, name, smtp_host, smtp_port, smtp_user, smtp_pass, hourly_limit, delay_seconds, created_at, updated_at)
VALUES 
(
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'oliver.brown@domain.io',
    'Oliver Brown',
    'smtp.ethereal.email',
    587,
    NULL,
    NULL,
    100,
    2,
    NOW(),
    NOW()
),
(
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'growth@domain.io',
    'Outbox Growth Team',
    'smtp.ethereal.email',
    587,
    NULL,
    NULL,
    50,
    5,
    NOW(),
    NOW()
) ON CONFLICT (user_id, email) DO NOTHING;

-- 3. Insert Initial Completed Campaign for Display in Sent tab
INSERT INTO campaigns (id, user_id, sender_id, subject, body, start_time, delay_seconds, hourly_limit, status, total_recipients, sent_count, failed_count, created_at, updated_at)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Re: Project Update',
    '<p>Hi Sarah,</p><p>Thanks for the rainbow forest. Looks good!</p>',
    NOW() - INTERVAL '2 hours',
    2,
    100,
    'COMPLETED',
    2,
    2,
    0,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
) ON CONFLICT (id) DO NOTHING;

-- 4. Insert Sent Emails corresponding to Figma Sent View
INSERT INTO emails (id, campaign_id, sender_id, user_id, recipient, subject, body, scheduled_at, sent_at, status, bullmq_job_id, idempotency_key, ethereal_preview_url, created_at, updated_at)
VALUES 
(
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'sarah.wilson@domain.com',
    'Re: Project Update',
    '<p>Hi Sarah,</p><p>Thanks for the rainbow forest. Looks good!</p>',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours',
    'SENT',
    'job-seed-sent-01',
    'campaign_c0000000-0000-0000-0000-000000000001_sarah.wilson@domain.com',
    'https://ethereal.email/message/seed-preview-01',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
),
(
    'd0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'support@domain.com',
    'Issue with login',
    '<p>I am having trouble logged in to the dashboard.</p>',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour',
    'SENT',
    'job-seed-sent-02',
    'campaign_c0000000-0000-0000-0000-000000000001_support@domain.com',
    'https://ethereal.email/message/seed-preview-02',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour'
) ON CONFLICT (id) DO NOTHING;
