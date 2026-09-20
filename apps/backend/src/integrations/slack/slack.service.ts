import axios from 'axios';
import { config } from '../../config/index.js';
import { prisma } from '../../config/prisma.js';
import { logger } from '../../utils/logger.js';

class SlackService {
  isConfigured(): boolean {
    return !!(config.slack.clientId && config.slack.clientSecret);
  }

  getAuthorizationUrl(userId: string): string {
    const scopes = ['chat:write', 'incoming-webhook', 'channels:read'];
    const params = new URLSearchParams({
      client_id: config.slack.clientId,
      scope: scopes.join(','),
      redirect_uri: config.slack.redirectUri,
      state: userId,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code: string, stateUserId: string): Promise<any> {
    try {
      const response = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        null,
        {
          params: {
            client_id: config.slack.clientId,
            client_secret: config.slack.clientSecret,
            code,
            redirect_uri: config.slack.redirectUri,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;
      if (!data.ok) {
        throw new Error(data.error || 'Slack OAuth exchange failed');
      }

      const connection = await prisma.slackConnection.upsert({
        where: { userId: stateUserId },
        update: {
          slackUserId: data.authed_user?.id || data.app_id || 'unknown',
          teamId: data.team?.id || '',
          teamName: data.team?.name || 'Workspace',
          channelId: data.incoming_webhook?.channel_id || null,
          channelName: data.incoming_webhook?.channel || null,
          accessToken: data.access_token,
          incomingWebhookUrl: data.incoming_webhook?.url || null,
        },
        create: {
          userId: stateUserId,
          slackUserId: data.authed_user?.id || data.app_id || 'unknown',
          teamId: data.team?.id || '',
          teamName: data.team?.name || 'Workspace',
          channelId: data.incoming_webhook?.channel_id || null,
          channelName: data.incoming_webhook?.channel || null,
          accessToken: data.access_token,
          incomingWebhookUrl: data.incoming_webhook?.url || null,
        },
      });

      logger.info('💬 Slack connected successfully for user', {
        userId: stateUserId,
        teamName: connection.teamName,
      });

      return connection;
    } catch (err: any) {
      logger.error('❌ Slack OAuth callback error:', { error: err.message });
      throw err;
    }
  }

  async sendRateLimitAlert(params: {
    userId: string;
    senderEmail: string;
    hourlyLimit: number;
    rescheduledTime: Date;
    recipient: string;
  }): Promise<boolean> {
    try {
      const connection = await prisma.slackConnection.findUnique({
        where: { userId: params.userId },
      });

      if (!connection) {
        logger.info('ℹ️ Slack not connected for user; skipping Slack rate-limit alert safely without error.', {
          userId: params.userId,
        });
        return false;
      }

      const messageText = `⚠️ *Email Rate Limit Exceeded*\n` +
        `• *Sender:* \`${params.senderEmail}\`\n` +
        `• *Configured Hourly Limit:* ${params.hourlyLimit} emails/hour\n` +
        `• *Action Taken:* Email to \`${params.recipient}\` has been rescheduled into the next hourly window.\n` +
        `• *Next Window Run:* ${params.rescheduledTime.toISOString()}`;

      if (connection.incomingWebhookUrl) {
        // Send via incoming webhook
        await axios.post(connection.incomingWebhookUrl, {
          text: messageText,
        });
        logger.info('🚀 Real Slack notification sent via Incoming Webhook successfully!', {
          senderEmail: params.senderEmail,
        });
        return true;
      } else if (connection.accessToken && connection.channelId) {
        // Send via chat.postMessage API
        await axios.post(
          'https://slack.com/api/chat.postMessage',
          {
            channel: connection.channelId,
            text: messageText,
          },
          {
            headers: {
              Authorization: `Bearer ${connection.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        logger.info('🚀 Real Slack notification sent via Web API chat.postMessage successfully!', {
          senderEmail: params.senderEmail,
        });
        return true;
      }

      return false;
    } catch (err: any) {
      logger.error('❌ Error sending Slack notification (will not crash email processing):', {
        error: err.message,
      });
      return false;
    }
  }

  async disconnect(userId: string): Promise<boolean> {
    try {
      await prisma.slackConnection.deleteMany({
        where: { userId },
      });
      logger.info('🔌 Slack disconnected for user', { userId });
      return true;
    } catch (err: any) {
      logger.error('❌ Failed to disconnect Slack:', { error: err.message });
      return false;
    }
  }

  async getStatus(userId: string): Promise<{ connected: boolean; teamName?: string; channel?: string }> {
    const conn = await prisma.slackConnection.findUnique({
      where: { userId },
    });
    if (!conn) {
      return { connected: false };
    }
    return {
      connected: true,
      teamName: conn.teamName,
      channel: conn.channelName || undefined,
    };
  }
}

export const slackService = new SlackService();
