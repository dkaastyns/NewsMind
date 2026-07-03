import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Pool } from 'pg';
import { InjectDatabasePool } from '../../common/database/database.constants';
import { AiProxyService } from '../ai-proxy/ai-proxy.service';
import { CreateArticleDto } from './dto/create-article.dto';

export interface ArticleResult {
  id: string;
  title: string;
  status: string;
  ai_summary: string;
  ai_review: string;
  ai_sentiment: string;
  ai_topic: string;
  ai_caption_social: string;
  ai_caption_web: string;
  created_at: Date;
}

@Injectable()
export class ArticlesService {
  constructor(
    @InjectDatabasePool() private readonly pool: Pool,
    private readonly aiProxy: AiProxyService,
  ) {}

  async create(dto: CreateArticleDto, userId: string): Promise<ArticleResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert initial row (status: processing)
      const slug = this._generateSlug(dto.title);
      const insertRes = await client.query<{ id: string }>(
        `INSERT INTO news_clippings
           (title, slug, source_url, raw_text, status, created_by)
         VALUES ($1, $2, $3, $4, 'processing', $5)
         RETURNING id`,
        [dto.title, slug, dto.source_url ?? null, dto.extracted_text ?? null, userId],
      );
      const articleId = insertRes.rows[0].id;

      await client.query('COMMIT');

      // 2. Call AI service synchronously (outside transaction, may take 5-15s)
      const aiResult = await this.aiProxy.analyze({
        article_id: articleId,
        source_type: dto.source_type,
        source_url: dto.source_url,
        extracted_text: dto.extracted_text ?? '',
        title: dto.title,
      });

      // 3. Update row with AI results, set status to 'aktif'
      await this.pool.query(
        `UPDATE news_clippings SET
           ai_summary        = $1,
           ai_review         = $2,
           ai_sentiment      = $3,
           ai_topic          = $4,
           ai_caption_social = $5,
           ai_caption_web    = $6,
           status            = 'aktif',
           updated_at        = now()
         WHERE id = $7`,
        [
          JSON.stringify(aiResult.ringkasan),    // ai_summary: JSON array 3 poin
          aiResult.ulasan,                        // ai_review
          aiResult.sentimen,                      // ai_sentiment
          aiResult.topik.join(', '),              // ai_topic
          aiResult.caption_instagram,             // ai_caption_social
          JSON.stringify(aiResult.draft_berita),  // ai_caption_web: JSON {judul, paragraf}
          articleId,
        ],
      );

      // 4. Return complete result
      const finalRes = await this.pool.query<ArticleResult>(
        `SELECT id, title, status, ai_summary, ai_review, ai_sentiment,
                ai_topic, ai_caption_social, ai_caption_web, created_at
         FROM news_clippings WHERE id = $1`,
        [articleId],
      );
      return finalRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        `Gagal memproses artikel: ${(err as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }

  async findAll(page = 1, limit = 20): Promise<ArticleResult[]> {
    const offset = (page - 1) * limit;
    const { rows } = await this.pool.query<ArticleResult>(
      `SELECT id, title, status, ai_summary, ai_review, ai_sentiment,
              ai_topic, ai_caption_social, ai_caption_web, created_at
       FROM news_clippings
       WHERE status = 'aktif'
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows;
  }

  async findOne(id: string): Promise<ArticleResult | null> {
    const { rows } = await this.pool.query<ArticleResult>(
      `SELECT id, title, source_url, status, raw_text,
              ai_summary, ai_review, ai_sentiment, ai_topic,
              ai_caption_social, ai_caption_web, created_at
       FROM news_clippings WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  private _generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80) + '-' + Date.now();
  }
}
