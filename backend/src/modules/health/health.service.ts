import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database';

@Injectable()
export class HealthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStatus() {
    const [databaseHealthy, databaseName] = await Promise.all([
      this.databaseService.ping(),
      this.databaseService.getDatabaseName(),
    ]);

    return {
      status: 'ok',
      service: 'backend',
      product: 'NewsMind Humas DPRD',
      environment: process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      database: {
        healthy: databaseHealthy,
        name: databaseName ?? 'unknown',
        expectedName: 'newsmind',
      },
    };
  }
}
