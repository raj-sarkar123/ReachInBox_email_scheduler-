import { Router } from 'express';
import { senderController } from '../controllers/sender.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', senderController.getSenders);
router.post('/', senderController.createSender);

export default router;
