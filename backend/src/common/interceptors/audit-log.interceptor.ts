import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.constants';
import { Request } from 'express';

export interface AuditContext {
  entityType: string;
  entityId?: string;
  action: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
}

// Key yang dipakai controller untuk menaruh audit context ke request
export const AUDIT_CONTEXT_KEY = '__audit_context__';

/**
 * AuditLogInterceptor — menulis baris ke audit_logs setelah setiap mutasi
 * pada tabel sensitif (news_clippings, users, workflow_approvals, dll).
 *
 * Cara pakai di controller:
 *   req[AUDIT_CONTEXT_KEY] = { entityType: 'news_clippings', action: 'CREATE' };
 *
 * Interceptor akan baca context ini dan tulis ke DB setelah response dikirim.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<
      Request & {
        user?: { id: string };
        [AUDIT_CONTEXT_KEY]?: AuditContext;
      }
    >();

    return next.handle().pipe(
      tap(async () => {
        const auditCtx: AuditContext | undefined = req[AUDIT_CONTEXT_KEY];
        if (!auditCtx) return;

        const actorId: string | null = req.user?.id ?? null;
        const ipRaw = req.ip ?? req.socket?.remoteAddress ?? null;

        try {
          await this.pool.query(
            `INSERT INTO audit_logs
               (actor_user_id, entity_type, entity_id, action,
                before_data, after_data, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8)`,
            [
              actorId,
              auditCtx.entityType,
              auditCtx.entityId ?? null,
              auditCtx.action,
              auditCtx.beforeData ? JSON.stringify(auditCtx.beforeData) : null,
              auditCtx.afterData ? JSON.stringify(auditCtx.afterData) : null,
              ipRaw,
              req.headers['user-agent'] ?? null,
            ],
          );
        } catch (err) {
          // Gagal audit log tidak boleh gagalkan request utama
          console.error('[AuditLogInterceptor] Failed to write audit log:', err);
        }
      }),
    );
  }
}
