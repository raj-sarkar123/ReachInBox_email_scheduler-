import { Request, Response } from 'express';
import { z } from 'zod';
import { campaignService } from '../services/campaign.service.js';

const createCampaignSchema = z.object({
  senderId: z.string().uuid(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string()).min(1, 'At least one recipient is required'),
  startTime: z.string().datetime().optional(),
  delaySeconds: z.number().int().min(0).max(3600).optional(),
  hourlyLimit: z.number().int().min(1).max(10000).optional(),
});

export const campaignController = {
  createCampaign: async (req: Request, res: Response) => {
    try {
      const parsed = createCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: parsed.error.format(),
        });
      }

      const result = await campaignService.createAndScheduleCampaign(req.user!.id, parsed.data);
      res.status(201).json({
        success: true,
        message: 'Campaign scheduled successfully',
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message,
      });
    }
  },

  getCampaigns: async (req: Request, res: Response) => {
    try {
      const campaigns = await campaignService.getCampaignsByUser(req.user!.id);
      res.json({
        success: true,
        data: campaigns,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getCampaignById: async (req: Request, res: Response) => {
    try {
      const campaign = await campaignService.getCampaignById(req.params.id, req.user!.id);
      if (!campaign) {
        return res.status(404).json({ success: false, error: 'Campaign not found' });
      }
      res.json({
        success: true,
        data: campaign,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
