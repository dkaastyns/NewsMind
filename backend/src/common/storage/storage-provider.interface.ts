/**
 * StorageProvider — interface abstraksi untuk file storage.
 * Implementasi: LocalStorageProvider | AzureBlobProvider | S3Provider.
 * Dipilih via env STORAGE_PROVIDER=local|azure|aws
 *
 * Sesuai AGENTS.md §8 — modul domain TIDAK BOLEH import SDK cloud langsung.
 * Selalu gunakan token STORAGE_PROVIDER untuk inject provider ini.
 */
export interface StorageProvider {
  /**
   * Upload file ke storage.
   * Path: clippings/{year}/{month}/{uuid}-{original_filename}
   */
  upload(
    file: Buffer,
    path: string,
    mimeType: string,
  ): Promise<{ url: string; key: string }>;

  /** Generate signed/temporary URL untuk download */
  getSignedUrl(key: string, expiresInSec: number): Promise<string>;

  /** Hapus file dari storage */
  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER_TOKEN = 'STORAGE_PROVIDER';
