import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';

const createSenderSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Sender name is required'),
  hourlyLimit: z.number().int().min(1).max(10000).optional(),
  delaySeconds: z.number().int().min(0).max(3600).optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
});

export const senderController = {
  getSenders: async (req: Request, res: Response) => {
    try {
      const senders = await prisma.sender.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        success: true,
        data: senders,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  createSender: async (req: Request, res: Response) => {
    try {
      const parsed = createSenderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: parsed.error.format(),
        });
      }

      const sender = await prisma.sender.create({
        data: {
          userId: req.user!.id,
          email: parsed.data.email,
          name: parsed.data.name,
          hourlyLimit: parsed.data.hourlyLimit ?? 100,
          delaySeconds: parsed.data.delaySeconds ?? 2,
          smtpHost: parsed.data.smtpHost || 'smtp.ethereal.email',
          smtpPort: parsed.data.smtpPort || 587,
          smtpUser: parsed.data.smtpUser,
          smtpPass: parsed.data.smtpPass,
        },
      });

      res.status(201).json({
        success: true,
        data: sender,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
};
