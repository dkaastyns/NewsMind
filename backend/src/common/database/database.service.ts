import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Pool } from 'pg';
import { DATABASE_POOL } from './database.constants';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async getDatabaseName(): Promise<string | null> {
    try {
      const result = await this.pool.query<{ dbname: string }>(
        'SELECT current_database() AS dbname',
      );
      return result.rows[0]?.dbname ?? null;
    } catch {
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
