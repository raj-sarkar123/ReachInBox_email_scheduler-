import { Router } from 'express';
import authRoutes from './auth.routes.js';
import campaignRoutes from './campaign.routes.js';
import emailRoutes from './email.routes.js';
import senderRoutes from './sender.routes.js';
import slackRoutes from './slack.routes.js';
import healthRoutes from './health.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/campaigns', campaignRoutes);
apiRouter.use('/emails', emailRoutes);
apiRouter.use('/senders', senderRoutes);
apiRouter.use('/slack', slackRoutes);
apiRouter.use('/health', healthRoutes);

export default apiRouter;
