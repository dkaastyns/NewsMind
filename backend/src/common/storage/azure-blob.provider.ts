import { StorageProvider } from './storage-provider.interface';

/**
 * AzureBlobProvider — stub implementasi Azure Blob Storage.
 * TODO: install @azure/storage-blob dan implementasi nyata setelah
 * keputusan cloud provider final (AGENTS.md §2 — deadline akhir minggu 1).
 *
 * Aktifkan dengan: STORAGE_PROVIDER=azure di .env
 */
export class AzureBlobProvider implements StorageProvider {
  constructor() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const container = process.env.AZURE_STORAGE_CONTAINER;
    if (!connStr || !container) {
      throw new Error(
        'AzureBlobProvider: AZURE_STORAGE_CONNECTION_STRING dan AZURE_STORAGE_CONTAINER wajib diset di .env',
      );
    }
    // TODO: new BlobServiceClient(connStr) setelah @azure/storage-blob diinstall
  }

  async upload(
    _file: Buffer,
    _path: string,
    _mimeType: string,
  ): Promise<{ url: string; key: string }> {
    throw new Error('AzureBlobProvider: belum diimplementasikan');
  }

  async getSignedUrl(_key: string, _expiresInSec: number): Promise<string> {
    throw new Error('AzureBlobProvider: belum diimplementasikan');
  }

  async delete(_key: string): Promise<void> {
    throw new Error('AzureBlobProvider: belum diimplementasikan');
  }
}
