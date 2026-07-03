import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  QUEUE_ARTICLE_PROCESSING,
  QUEUE_NOTIFICATION,
} from './queue.constants';
import { AiProxyModule } from '../../modules/ai-proxy/ai-proxy.module';
import { ArticleProcessingProcessor } from './processors/article-processing.processor';
import { NotificationProcessor } from './processors/notification.processor';

/**
 * BullMqModule — konfigurasi BullMQ global.
 * Register semua queue di sini agar bisa di-inject di modul manapun (karena module ini @Global()).
 */
@Global()
@Module({
  imports: [
    AiProxyModule,
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_ARTICLE_PROCESSING },
      { name: QUEUE_NOTIFICATION },
    ),
  ],
  providers: [
    ArticleProcessingProcessor,
    NotificationProcessor,
  ],
  exports: [BullModule],
})
export class QueueModule {}
