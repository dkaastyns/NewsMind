import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiProxyService } from './ai-proxy.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  @Post('chat')
  async chat(@Body() payload: { message: string, history: any[] }) {
    return this.aiProxyService.chat(payload);
  }
}
