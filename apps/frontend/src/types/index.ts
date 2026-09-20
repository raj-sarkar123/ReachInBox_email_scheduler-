export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RATE_LIMITED_RESCHEDULED';

export interface User {
  id: string;
  googleId?: string | null;
  name: string;
  email: string;
  avatar?: string | null;
}

export interface Sender {
  id: string;
  userId: string;
  name: string;
  email: string;
  smtpHost?: string | null;
  smtpPort?: number | null;
  hourlyLimit: number;
  delaySeconds: number;
}

export interface Email {
  id: string;
  campaignId: string;
  senderId: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: EmailStatus;
  bullmqJobId?: string | null;
  idempotencyKey: string;
  failureReason?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
  sender?: Sender;
}

export interface Campaign {
  id: string;
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  sender?: Sender;
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
  channel?: string;
}
