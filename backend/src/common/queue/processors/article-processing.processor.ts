import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiProxyService } from '../../../modules/ai-proxy/ai-proxy.service';
import { QUEUE_ARTICLE_PROCESSING } from '../queue.constants';

type ArticleProcessingJob = {
  article_id?: string;
  source_type?: 'url' | 'pdf' | 'image' | 'text';
  source_url?: string;
  raw_text?: string;
  extracted_text?: string;
  title?: string;
  text_length?: number;
  has_image?: boolean;
  has_pdf?: boolean;
};

@Processor(QUEUE_ARTICLE_PROCESSING)
@Injectable()
export class ArticleProcessingProcessor extends WorkerHost {
  constructor(private readonly aiProxyService: AiProxyService) {
    super();
  }

  async process(job: Job<ArticleProcessingJob, unknown, string>): Promise<unknown> {
    const payload = {
      article_id: job.data.article_id ?? String(job.id ?? ''),
      source_type: job.data.source_type ?? 'text',
      source_url: job.data.source_url,
      raw_text: job.data.raw_text ?? '',
      extracted_text: job.data.extracted_text ?? '',
      title: job.data.title ?? '',
      text_length: job.data.text_length ?? 0,
      has_image: job.data.has_image ?? false,
      has_pdf: job.data.has_pdf ?? false,
    };

    return this.aiProxyService.analyze({
      article_id: payload.article_id,
      source_type: payload.source_type as any,
      source_url: payload.source_url,
      extracted_text: payload.extracted_text,
      title: payload.title
    });
  }
}
