import { Request, Response } from 'express';
import { googleAuthService } from '../integrations/google/google-auth.service.js';
import { authService } from '../services/auth.service.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export const authController = {
  // Initiates Google OAuth redirect
  googleAuthRedirect: (req: Request, res: Response) => {
    try {
      if (!googleAuthService.isConfigured()) {
        // If Google credentials are not yet set up, redirect with hint or trigger demo login
        logger.warn('Google OAuth credentials not configured in .env; redirecting to demo login callback');
        return res.redirect(`${config.frontendUrl}/login?warning=google_not_configured`);
      }
      const url = googleAuthService.getAuthorizationUrl();
      res.redirect(url);
    } catch (err: any) {
      logger.error('Google auth redirect failed:', { error: err.message });
      res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(err.message)}`);
    }
  },

  // Handles Google OAuth callback
  googleAuthCallback: async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.redirect(`${config.frontendUrl}/login?error=missing_code`);
      }

      const googleUser = await googleAuthService.verifyCodeAndGetUser(code);
      const { token } = await authService.handleGoogleUser(googleUser);

      // Redirect user back to frontend dashboard with JWT token
      res.redirect(`${config.frontendUrl}/login/callback?token=${token}`);
    } catch (err: any) {
      logger.error('Google auth callback error:', { error: err.message });
      res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(err.message)}`);
    }
  },

  // Get current authenticated user profile
  getMe: async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: req.user,
    });
  },

  // Logout
  logout: (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  },

  // Demo / Local quick login for instant testing
  demoLogin: async (req: Request, res: Response) => {
    try {
      const { user, token } = await authService.getOrCreateDemoUser();
      res.json({
        success: true,
        data: { user, token },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
