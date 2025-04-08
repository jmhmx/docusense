import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './crypto.service';
import { KeyStorageService } from './key-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [CryptoService, KeyStorageService],
  exports: [CryptoService, KeyStorageService],
})
export class CryptoModule {}
