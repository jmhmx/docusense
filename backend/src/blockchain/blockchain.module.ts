import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { DocumentsModule } from '../documents/documents.module';
import { AuditModule } from '../audit/audit.module';
import { AdminModule } from 'src/admin/admin.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => DocumentsModule),
    AuditModule,
    forwardRef(() => AdminModule),
  ],
  providers: [BlockchainService],
  controllers: [BlockchainController],
  exports: [BlockchainService],
})
export class BlockchainModule {}
