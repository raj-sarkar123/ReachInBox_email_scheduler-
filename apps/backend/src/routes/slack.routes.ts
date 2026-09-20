import { Router } from 'express';
import { slackController } from '../controllers/slack.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Callback does not have auth header (Slack redirects here directly)
router.get('/callback', slackController.callback);

router.get('/connect', requireAuth, slackController.connect);
router.post('/disconnect', requireAuth, slackController.disconnect);
router.get('/status', requireAuth, slackController.getStatus);

export default router;
