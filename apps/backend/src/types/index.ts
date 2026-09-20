export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RATE_LIMITED_RESCHEDULED';

export interface EmailJobData {
  emailId: string;
  campaignId: string;
  senderId: string;
  userId: string;
  recipient: string;
  scheduledAt: string;
  idempotencyKey: string;
}

export interface CreateCampaignDTO {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string;
  delaySeconds?: number;
  hourlyLimit?: number;
}

export interface CreateSenderDTO {
  email: string;
  name: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  hourlyLimit?: number;
  delaySeconds?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SearchQueryDTO {
  q?: string;
  status?: EmailStatus;
  limit?: number;
  offset?: number;
}
