import * as fs from 'node:fs';
import * as path from 'node:path';
import { StorageProvider } from './storage-provider.interface';

/**
 * LocalStorageProvider — simpan file ke disk lokal (development only).
 * Jangan gunakan di production. Pilih Azure atau AWS untuk production.
 *
 * File disimpan di: ./uploads/{key}
 * URL disajikan via endpoint statis NestJS.
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly uploadsDir: string;

  constructor() {
    this.uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async upload(
    file: Buffer,
    filePath: string,
    _mimeType: string,
  ): Promise<{ url: string; key: string }> {
    const fullPath = path.join(this.uploadsDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, file);
    return {
      url: `/uploads/${filePath}`,
      key: filePath,
    };
  }

  async getSignedUrl(key: string, _expiresInSec: number): Promise<string> {
    // Local: return URL statis langsung (tidak expire)
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.uploadsDir, key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}
