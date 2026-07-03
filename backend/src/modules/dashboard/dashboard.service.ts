import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { InjectDatabasePool } from '../../common/database/database.constants';

@Injectable()
export class DashboardService {
  constructor(@InjectDatabasePool() private readonly pool: Pool) {}

  async getStats() {
    // We can query news_clippings to get stats
    const { rows: totalRows } = await this.pool.query('SELECT COUNT(*) as count FROM news_clippings');
    const totalClippings = parseInt(totalRows[0].count, 10);

    const { rows: sentimentRows } = await this.pool.query(`
      SELECT ai_sentiment as sentiment, COUNT(*) as count 
      FROM news_clippings 
      WHERE ai_sentiment IS NOT NULL 
      GROUP BY ai_sentiment
    `);

    // We can just mock top_topics for now or extract from ai_topic
    const { rows: topicRows } = await this.pool.query(`
      SELECT ai_topic as topic, COUNT(*) as count 
      FROM news_clippings 
      WHERE ai_topic IS NOT NULL 
      GROUP BY ai_topic
      ORDER BY count DESC
      LIMIT 5
    `);

    return {
      total_clippings: totalClippings,
      sentiment_distribution: sentimentRows.map(r => ({ sentiment: r.sentiment, count: parseInt(r.count, 10) })),
      top_topics: topicRows.map(r => ({ topic: r.topic, count: parseInt(r.count, 10) })),
    };
  }
}
