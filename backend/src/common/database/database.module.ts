import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from './database.constants';
import { DatabaseService } from './database.service';

const createPool = () =>
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:5432/newsmind',
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
  });

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: createPool,
    },
    DatabaseService,
  ],
  exports: [DATABASE_POOL, DatabaseService],
})
export class DatabaseModule {}
