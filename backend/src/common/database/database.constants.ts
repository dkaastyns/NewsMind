import { Inject } from '@nestjs/common';
export const DATABASE_POOL = Symbol('DATABASE_POOL');
export const InjectDatabasePool = () => Inject(DATABASE_POOL);
