import { Global, Module, Provider } from '@nestjs/common';
import { STORAGE_PROVIDER_TOKEN } from './storage-provider.interface';
import { LocalStorageProvider } from './local.provider';
import { AzureBlobProvider } from './azure-blob.provider';
import { S3Provider } from './s3.provider';

const storageProvider: Provider = {
  provide: STORAGE_PROVIDER_TOKEN,
  useFactory: () => {
    const selected = process.env.STORAGE_PROVIDER ?? 'local';
    switch (selected) {
      case 'azure':
        return new AzureBlobProvider();
      case 'aws':
        return new S3Provider();
      case 'local':
      default:
        return new LocalStorageProvider();
    }
  },
};

/**
 * StorageModule — Global module. Inject provider aktif via STORAGE_PROVIDER_TOKEN.
 * Modul domain tidak perlu import StorageModule karena sudah global.
 *
 * @example
 *   constructor(@Inject(STORAGE_PROVIDER_TOKEN) private storage: StorageProvider) {}
 */
@Global()
@Module({
  providers: [storageProvider],
  exports: [STORAGE_PROVIDER_TOKEN],
})
export class StorageModule {}
