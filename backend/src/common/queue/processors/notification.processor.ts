import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NOTIFICATION } from '../queue.constants';

type NotificationJob = {
  title?: string;
  message?: string;
  user_id?: string;
};

@Processor(QUEUE_NOTIFICATION)
@Injectable()
export class NotificationProcessor extends WorkerHost {
  async process(job: Job<NotificationJob, unknown, string>): Promise<unknown> {
    return {
      notification_id: String(job.id ?? ''),
      title: job.data.title ?? 'NewsMind Notification',
      message: job.data.message ?? '',
      user_id: job.data.user_id ?? null,
      delivered: true,
    };
  }
}
