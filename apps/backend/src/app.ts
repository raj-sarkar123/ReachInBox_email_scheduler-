import express, { Express } from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import apiRouter from './routes/index.js';
import { emailQueue } from './queues/email.queue.js';
import { errorHandler } from './middleware/error.middleware.js';
import { bullBoardAuth } from './middleware/bullBoardAuth.middleware.js';
import { config } from './config/index.js';

export function createApp(): Express {
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: [config.frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Bull Board Queue Dashboard UI Setup (Mounted at /admin/queues)
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter: serverAdapter,
  });

  // Protected: requires HTTP Basic Auth (ADMIN_USERNAME / ADMIN_PASSWORD)
  app.use('/admin/queues', bullBoardAuth, serverAdapter.getRouter());

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Fallback 404 handler
  app.use((req, res) => {
    res.status(404).json({ success: false, error: `Cannot ${req.method} ${req.path}` });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
