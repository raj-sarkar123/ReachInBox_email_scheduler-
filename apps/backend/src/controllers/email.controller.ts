import { Request, Response } from 'express';
import { emailDataService } from '../services/email.service.js';
import { EmailStatus } from '../types/index.js';

export const emailController = {
  getScheduledEmails: async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const emails = await emailDataService.getScheduledEmails(req.user!.id, limit, offset);

      res.json({
        success: true,
        data: emails,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getSentEmails: async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const emails = await emailDataService.getSentEmails(req.user!.id, limit, offset);

      res.json({
        success: true,
        data: emails,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getEmailById: async (req: Request, res: Response) => {
    try {
      const email = await emailDataService.getEmailById(req.params.id, req.user!.id);
      if (!email) {
        return res.status(404).json({ success: false, error: 'Email not found' });
      }

      res.json({
        success: true,
        data: email,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  searchEmails: async (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const status = req.query.status as EmailStatus | undefined;
      const results = await emailDataService.searchEmails(req.user!.id, query, status);

      res.json({
        success: true,
        data: results,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
deleteEmail: async (req: Request, res: Response) => {
  try {
    await emailDataService.deleteEmail(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Email deleted' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
},
  getCounts: async (req: Request, res: Response) => {
    try {
      const counts = await emailDataService.getCounts(req.user!.id);
      res.json({
        success: true,
        data: counts,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
