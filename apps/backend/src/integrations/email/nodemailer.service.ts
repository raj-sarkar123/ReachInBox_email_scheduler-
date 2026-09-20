import nodemailer from 'nodemailer';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

class EmailIntegrationService {
  private transporter: nodemailer.Transporter | null = null;
  private etherealAccount: any = null;

  async init(): Promise<void> {
    try {
      if (config.ethereal.user && config.ethereal.password) {
        this.transporter = nodemailer.createTransport({
          host: config.ethereal.host,
          port: config.ethereal.port,
          secure: false,
          auth: {
            user: config.ethereal.user,
            pass: config.ethereal.password,
          },
        });
        logger.info('📧 Nodemailer initialized with configured Ethereal credentials', {
          user: config.ethereal.user,
        });
      } else {
        // Auto-generate test account if credentials not explicitly configured
        logger.info('📧 No Ethereal credentials provided. Creating ephemeral test account...');
        this.etherealAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: this.etherealAccount.smtp.host,
          port: this.etherealAccount.smtp.port,
          secure: this.etherealAccount.smtp.secure,
          auth: {
            user: this.etherealAccount.user,
            pass: this.etherealAccount.pass,
          },
        });
        logger.info('📧 Ethereal test account created successfully', {
          user: this.etherealAccount.user,
        });
      }
    } catch (err: any) {
      logger.error('❌ Failed to initialize Nodemailer transporter:', { error: err.message });
      throw err;
    }
  }

  async sendEmail(options: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ messageId: string; previewUrl: string | null }> {
    if (!this.transporter) {
      await this.init();
    }

    const info = await this.transporter!.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    logger.info('📨 Email dispatched successfully via Ethereal SMTP', {
      to: options.to,
      messageId: info.messageId,
      previewUrl: previewUrl || 'N/A',
    });

    return {
      messageId: info.messageId,
      previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
    };
  }
}

export const emailService = new EmailIntegrationService();
