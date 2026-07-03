import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { AiProxyModule } from '../ai-proxy/ai-proxy.module';
import { DatabaseModule } from '../../common/database/database.module';

@Module({
  imports: [AiProxyModule, DatabaseModule],
  controllers: [ArticlesController],
  providers: [ArticlesService]
})
export class ArticlesModule {}
