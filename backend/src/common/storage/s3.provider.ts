import { StorageProvider } from './storage-provider.interface';

/**
 * S3Provider — stub implementasi AWS S3.
 * TODO: install @aws-sdk/client-s3 dan implementasi nyata setelah
 * keputusan cloud provider final (AGENTS.md §2 — deadline akhir minggu 1).
 *
 * Aktifkan dengan: STORAGE_PROVIDER=aws di .env
 */
export class S3Provider implements StorageProvider {
  constructor() {
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION;
    if (!bucket || !region) {
      throw new Error(
        'S3Provider: AWS_S3_BUCKET dan AWS_REGION wajib diset di .env',
      );
    }
    // TODO: new S3Client({ region }) setelah @aws-sdk/client-s3 diinstall
  }

  async upload(
    _file: Buffer,
    _path: string,
    _mimeType: string,
  ): Promise<{ url: string; key: string }> {
    throw new Error('S3Provider: belum diimplementasikan');
  }

  async getSignedUrl(_key: string, _expiresInSec: number): Promise<string> {
    throw new Error('S3Provider: belum diimplementasikan');
  }

  async delete(_key: string): Promise<void> {
    throw new Error('S3Provider: belum diimplementasikan');
  }
}
