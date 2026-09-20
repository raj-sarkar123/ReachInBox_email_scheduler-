import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Protects the Bull Board queue dashboard (/admin/queues) with HTTP Basic Auth.
 *
 * The dashboard exposes live queue internals (job payloads, recipients, timing),
 * so it must not be publicly reachable. Credentials come from environment
 * variables (ADMIN_USERNAME / ADMIN_PASSWORD) — never hardcoded.
 *
 * This is intentionally simple HTTP Basic Auth rather than the app's JWT scheme:
 * Bull Board is a server-rendered UI navigated to directly in the browser
 * (not an XHR/fetch client that can attach an Authorization: Bearer header),
 * so Basic Auth is the standard, low-friction way to gate this kind of
 * server-side admin panel.
 */
export function bullBoardAuth(req: Request, res: Response, next: NextFunction): void {
  const { username, password } = config.admin;

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="ReachInbox Queue Dashboard"');
    res.status(401).send('Authentication required to access the queue dashboard.');
    return;
  }

  const base64Credentials = authHeader.split(' ')[1];
  const [providedUser, providedPass] = Buffer.from(base64Credentials, 'base64')
    .toString('utf-8')
    .split(':');

  if (providedUser === username && providedPass === password) {
    next();
    return;
  }

  logger.warn('🔒 Rejected unauthorized Bull Board access attempt', {
    ip: req.ip,
    attemptedUser: providedUser,
  });

  res.set('WWW-Authenticate', 'Basic realm="ReachInbox Queue Dashboard"');
  res.status(401).send('Invalid credentials.');
}
