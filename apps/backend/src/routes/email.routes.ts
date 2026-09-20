import { Router } from 'express';
import { emailController } from '../controllers/email.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/scheduled', emailController.getScheduledEmails);
router.get('/sent', emailController.getSentEmails);
router.get('/search', emailController.searchEmails);
router.get('/counts', emailController.getCounts);
router.get('/:id', emailController.getEmailById);
router.delete('/:id', emailController.deleteEmail);
export default router;
