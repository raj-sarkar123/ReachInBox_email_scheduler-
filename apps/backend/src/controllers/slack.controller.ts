import { Request, Response } from 'express';
import { slackService } from '../integrations/slack/slack.service.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export const slackController = {
  connect: (req: Request, res: Response) => {
    try {
      if (!slackService.isConfigured()) {
        return res.status(400).json({
          success: false,
          error: 'Slack OAuth is not configured in .env (SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are required).',
        });
      }

      const url = slackService.getAuthorizationUrl(req.user!.id);
      res.json({
        success: true,
        data: { url },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  callback: async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string;
      const stateUserId = req.query.state as string;

      if (!code || !stateUserId) {
        return res.redirect(`${config.frontendUrl}/dashboard?slack_error=missing_parameters`);
      }

      await slackService.handleOAuthCallback(code, stateUserId);
      res.redirect(`${config.frontendUrl}/dashboard?slack_success=connected`);
    } catch (err: any) {
      logger.error('Slack OAuth callback controller error:', { error: err.message });
      res.redirect(`${config.frontendUrl}/dashboard?slack_error=${encodeURIComponent(err.message)}`);
    }
  },

  disconnect: async (req: Request, res: Response) => {
    try {
      await slackService.disconnect(req.user!.id);
      res.json({
        success: true,
        message: 'Slack disconnected successfully',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getStatus: async (req: Request, res: Response) => {
    try {
      const status = await slackService.getStatus(req.user!.id);
      res.json({
        success: true,
        data: status,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
