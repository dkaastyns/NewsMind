import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { ArchiveModule } from './modules/archive/archive.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiProxyModule } from './modules/ai-proxy/ai-proxy.module';

import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // 100 requests per minute
    }]),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
    ArchiveModule,
    DashboardModule,
    AiProxyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
