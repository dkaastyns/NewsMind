import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface AnalyzeRequest {
  article_id: string;
  source_type: 'url' | 'pdf' | 'text';
  source_url?: string;
  extracted_text?: string;
  title?: string;
}

export interface DraftBerita {
  judul: string;
  paragraf: string[];
}

export interface AnalyzeResult {
  article_id: string;
  ringkasan: string[];
  ulasan: string;
  sentimen: 'Positif' | 'Netral' | 'Negatif';
  topik: string[];
  caption_instagram: string;
  draft_berita: DraftBerita;
  model: string;
}

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async analyze(payload: AnalyzeRequest): Promise<AnalyzeResult> {
    try {
      const { data } = await axios.post<AnalyzeResult>(
        `${this.baseUrl}/api/v1/pipeline/analyze`,
        payload,
        { timeout: 60_000 },  // 60s — Gemini bisa agak lambat
      );
      return data;
    } catch (err: any) {
      this.logger.error('AI Service analyze failed', err?.response?.data ?? err?.message);
      throw new HttpException(
        err?.response?.data?.detail ?? 'AI Service tidak tersedia',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async previewRouting(payload: any): Promise<any> {
    // Mocked for compilation, semantic routing is now unified in analyze()
    return {
      route: 'general',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    };
  }

  async generateContent(payload: any): Promise<any> {
    // Mocked for compilation, content generation is now unified in analyze()
    return {
      caption: '',
      draft: '',
    };
  }

  async chat(payload: { message: string, history: any[] }): Promise<{ reply: string }> {
    try {
      const { data } = await axios.post<{ reply: string }>(
        `${this.baseUrl}/api/v1/pipeline/chat`,
        payload,
        { timeout: 30_000 },
      );
      return data;
    } catch (err: any) {
      this.logger.error('AI Service chat failed', err?.response?.data ?? err?.message);
      throw new HttpException(
        err?.response?.data?.detail ?? 'AI Service tidak tersedia',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
