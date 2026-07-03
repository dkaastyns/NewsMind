import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.constants';

@Injectable()
export class AuditRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  // TODO: Add methods for retrieving audit logs if needed
}
