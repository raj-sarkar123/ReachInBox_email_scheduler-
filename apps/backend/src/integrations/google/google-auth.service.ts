import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export interface GoogleUserProfile {
  googleId: string;
  email: string;
  name: string;
  avatar: string | null;
}

class GoogleAuthService {
  private client: OAuth2Client | null = null;

  constructor() {
    if (config.google.clientId && config.google.clientSecret) {
      this.client = new OAuth2Client(
        config.google.clientId,
        config.google.clientSecret,
        config.google.callbackUrl
      );
    }
  }

  isConfigured(): boolean {
    return !!(config.google.clientId && config.google.clientSecret);
  }

  getAuthorizationUrl(state?: string): string {
    if (!this.client) {
      throw new Error('Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
    }

    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'profile', 'email'],
      prompt: 'consent',
      state: state || '',
    });
  }

  async verifyCodeAndGetUser(code: string): Promise<GoogleUserProfile> {
    if (!this.client) {
      throw new Error('Google OAuth is not configured.');
    }

    try {
      const { tokens } = await this.client.getToken(code);
      this.client.setCredentials(tokens);

      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: config.google.clientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new Error('Invalid Google ID token payload.');
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        avatar: payload.picture || null,
      };
    } catch (err: any) {
      logger.error('❌ Failed to verify Google OAuth code:', { error: err.message });
      throw err;
    }
  }

  async verifyGoogleToken(token: string): Promise<GoogleUserProfile> {
    if (!this.client) {
      throw new Error('Google OAuth is not configured.');
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: config.google.clientId,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new Error('Invalid Google ID token.');
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        avatar: payload.picture || null,
      };
    } catch (err: any) {
      logger.error('❌ Token verification failed:', { error: err.message });
      throw err;
    }
  }
}

export const googleAuthService = new GoogleAuthService();
