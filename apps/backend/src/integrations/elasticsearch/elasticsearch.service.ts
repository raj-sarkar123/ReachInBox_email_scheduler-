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

      auth:
        config.elasticsearch.username && config.elasticsearch.password
          ? {
              username: config.elasticsearch.username,
              password: config.elasticsearch.password,
            }
          : undefined,

      requestTimeout: 10000,
      maxRetries: 3,
    });
  }

  async initIndex(): Promise<void> {
    try {
      // Test connection
      await this.client.ping();

      this.isAvailable = true;

      logger.info('🔎 Elasticsearch connected successfully.');

      // Check whether index exists
      const indexExists = await this.client.indices.exists({
        index: config.elasticsearch.index,
      });

      if (!indexExists) {
        await this.client.indices.create({
          index: config.elasticsearch.index,
          mappings: {
            properties: {
              id: {
                type: 'keyword',
              },

              userId: {
                type: 'keyword',
              },

              senderId: {
                type: 'keyword',
              },

              recipient: {
                type: 'text',
                fields: {
                  keyword: {
                    type: 'keyword',
                  },
                },
              },

              subject: {
                type: 'text',
                analyzer: 'standard',
              },

              body: {
                type: 'text',
                analyzer: 'standard',
              },

              status: {
                type: 'keyword',
              },

              scheduledAt: {
                type: 'date',
              },

              sentAt: {
                type: 'date',
              },

              createdAt: {
                type: 'date',
              },
            },
          },
        });

        logger.info(
          `🔍 Elasticsearch index '${config.elasticsearch.index}' created successfully.`
        );
      } else {
        logger.info(
          `🔍 Elasticsearch index '${config.elasticsearch.index}' verified.`
        );
      }
    } catch (err: any) {
      this.isAvailable = false;

      logger.warn(
        '⚠️ Elasticsearch initialization failed. Falling back to database search.',
        {
          error: err?.message || String(err),
          statusCode: err?.meta?.statusCode,
          body: err?.meta?.body,
          node: config.elasticsearch.url.replace(/\/\/.*@/, '//***@'),
        }
      );
    }
  }

  async indexEmail(doc: EmailIndexDocument): Promise<void> {
    if (!this.isAvailable) {
      return;
    }

    try {
      await this.client.index({
        index: config.elasticsearch.index,
        id: doc.id,
        document: doc,
      });

      logger.debug('📩 Email indexed into Elasticsearch', {
        id: doc.id,
        recipient: doc.recipient,
      });
    } catch (err: any) {
      logger.error('❌ Failed to index email into Elasticsearch', {
        id: doc.id,
        error: err?.message || String(err),
      });
    }
  }

  async deleteEmail(id: string): Promise<void> {
    if (!this.isAvailable) {
      return;
    }

    try {
      await this.client.delete({
        index: config.elasticsearch.index,
        id,
      });

      logger.debug('🗑️ Email removed from Elasticsearch', {
        id,
      });
    } catch (err: any) {
      // Document doesn't exist — nothing to do
      if (err?.meta?.statusCode === 404) {
        logger.debug(
          'Email not found in Elasticsearch (already deleted or never indexed)',
          { id }
        );
        return;
      }

      logger.error('❌ Failed to delete email from Elasticsearch', {
        id,
        error: err?.message || String(err),
      });

      throw err;
    }
  }

  async searchEmails(params: {
    userId: string;
    query?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    ids: string[];
    total: number;
    isElasticsearch: boolean;
  }> {
    if (!this.isAvailable) {
      return {
        ids: [],
        total: 0,
        isElasticsearch: false,
      };
    }

    try {
      const mustClauses: any[] = [
        {
          term: {
            userId: params.userId,
          },
        },
      ];

      // Optional status filter
      if (params.status) {
        mustClauses.push({
          term: {
            status: params.status,
          },
        });
      }

      // Optional search query
      if (params.query?.trim()) {
        mustClauses.push({
          multi_match: {
            query: params.query.trim(),
            fields: [
              'recipient^3',
              'subject^2',
              'body',
            ],
            fuzziness: 'AUTO',
          },
        });
      }

      const result = await this.client.search({
        index: config.elasticsearch.index,

        from: params.offset ?? 0,
        size: params.limit ?? 50,

        query: {
          bool: {
            must: mustClauses,
          },
        },

        sort: [
          {
            createdAt: {
              order: 'desc',
            },
          },
        ],
      });

      const hits = result.hits.hits;

      const total =
        typeof result.hits.total === 'number'
          ? result.hits.total
          : result.hits.total?.value ?? 0;

      const ids = hits
        .map((hit) => hit._id)
        .filter((id): id is string => Boolean(id));

      return {
        ids,
        total,
        isElasticsearch: true,
      };
    } catch (err: any) {
      logger.error(
        '❌ Elasticsearch search failed. Database fallback will be used.',
        {
          error: err?.message || String(err),
        }
      );

      return {
        ids: [],
        total: 0,
        isElasticsearch: false,
      };
    }
  }

  getStatus(): boolean {
    return this.isAvailable;
  }
}

export const elasticsearchService = new ElasticsearchService();