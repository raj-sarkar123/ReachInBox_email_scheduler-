import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/google', authController.googleAuthRedirect);
router.get('/google/callback', authController.googleAuthCallback);
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', requireAuth, authController.logout);
router.post('/demo', authController.demoLogin);

export default router;
