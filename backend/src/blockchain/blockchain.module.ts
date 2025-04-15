import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { DocumentsModule } from '../documents/documents.module';
import { SignaturesModule } from '../signatures/signatures.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ConfigModule, DocumentsModule, SignaturesModule, AuditModule],
  providers: [BlockchainService],
  controllers: [BlockchainController],
  exports: [BlockchainService],
})
export class BlockchainModule {}
