import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getBootstrapInfo() {
    return {
      name: 'NewsMind Backend',
      status: 'ok',
      version: process.env.npm_package_version ?? '0.0.1',
      environment: process.env.NODE_ENV ?? 'development',
      apiBasePath: '/api/v1',
      databaseName: 'newsmind',
      aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
      storageProvider: process.env.STORAGE_PROVIDER ?? 'local',
      message:
        'NewsMind v1 is online. The core scaffold is ready for news clipping, AI orchestration, workflow approval, and archive features.',
    };
  }
}
