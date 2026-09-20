import { Client } from '@elastic/elasticsearch';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export interface EmailIndexDocument {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  createdAt: string;
}

class ElasticsearchService {
  private client: Client;
  private isAvailable = false;

  constructor() {
    this.client = new Client({
      node: config.elasticsearch.url,
      requestTimeout: 5000,
      maxRetries: 3,
    });
  }

  async initIndex(): Promise<void> {
    try {
      const ping = await this.client.ping();
      if (!ping) {
        logger.warn('⚠️ Elasticsearch ping failed. Service may be starting or offline.');
        this.isAvailable = false;
        return;
      }

      this.isAvailable = true;
      const indexExists = await this.client.indices.exists({
        index: config.elasticsearch.index,
      });

      if (!indexExists) {
        await this.client.indices.create({
          index: config.elasticsearch.index,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text', analyzer: 'standard' },
              body: { type: 'text', analyzer: 'standard' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        });
        logger.info(`🔍 Elasticsearch index '${config.elasticsearch.index}' created successfully.`);
      } else {
        logger.info(`🔍 Elasticsearch index '${config.elasticsearch.index}' verified.`);
      }
    } catch (err: any) {
      this.isAvailable = false;
      logger.warn('⚠️ Elasticsearch init warning (gracefully falling back to DB search if unavailable):', {
        error: err.message,
      });
    }
  }

  async indexEmail(doc: EmailIndexDocument): Promise<void> {
    try {
      if (!this.isAvailable) {
        return;
      }

      await this.client.index({
        index: config.elasticsearch.index,
        id: doc.id,
        document: doc,
      });
      logger.debug('Indexed email into Elasticsearch', { id: doc.id, recipient: doc.recipient });
    } catch (err: any) {
      logger.error('❌ Failed to index email into Elasticsearch:', { id: doc.id, error: err.message });
    }
  }
async deleteEmail(id: string): Promise<void> {
  try {
    if (!this.isAvailable) {
      return;
    }

    await this.client.delete({
      index: config.elasticsearch.index,
      id,
    });
    logger.debug('Removed email from Elasticsearch', { id });
  } catch (err: any) {
    // 404 means the doc was never indexed (or already deleted) — not a real failure
    if (err.meta?.statusCode === 404) {
      logger.debug('Email not found in Elasticsearch index (already removed or never indexed)', { id });
      return;
    }
    logger.error('❌ Failed to delete email from Elasticsearch:', { id, error: err.message });
    throw err; // let the caller's try/catch in email.service.ts log/swallow it too
  }
}
  async searchEmails(params: {
    userId: string;
    query?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ ids: string[]; total: number; isElasticsearch: boolean }> {
    if (!this.isAvailable) {
      return { ids: [], total: 0, isElasticsearch: false };
    }

    try {
      const mustClauses: any[] = [
        { term: { userId: params.userId } },
      ];

      if (params.status) {
        mustClauses.push({ term: { status: params.status } });
      }

      if (params.query && params.query.trim().length > 0) {
        mustClauses.push({
          multi_match: {
            query: params.query.trim(),
            fields: ['recipient^3', 'subject^2', 'body'],
            fuzziness: 'AUTO',
          },
        });
      }

      const result = await this.client.search({
        index: config.elasticsearch.index,
        from: params.offset || 0,
        size: params.limit || 50,
        query: {
          bool: {
            must: mustClauses,
          },
        },
        sort: [
          { createdAt: { order: 'desc' } },
        ],
      });

      const hits = result.hits.hits;
      const total = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0;
      const ids = hits.map((hit) => hit._id as string);

      return { ids, total, isElasticsearch: true };
    } catch (err: any) {
      logger.error('❌ Elasticsearch search query error, fallback will be used:', { error: err.message });
      return { ids: [], total: 0, isElasticsearch: false };
    }
  }

  getStatus(): boolean {
    return this.isAvailable;
  }
}

export const elasticsearchService = new ElasticsearchService();
