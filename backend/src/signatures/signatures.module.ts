import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignaturesService } from './signatures.service';
import { SignaturesController } from './signatures.controller';
import { Signature } from './entities/signature.entity';
import { CryptoModule } from '../crypto/crypto.module';
import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { Document } from '../documents/entities/document.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { SatModule } from '../sat/sat.module';
import { EmailModule } from '../email/email.module';
import { SharingModule } from '../sharing/sharing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Signature, Document]),
    CryptoModule,
    forwardRef(() => DocumentsModule),
    UsersModule,
    AuditModule,
    forwardRef(() => BlockchainModule),
    SatModule,
    EmailModule,
    forwardRef(() => SharingModule),
  ],
  controllers: [SignaturesController],
  providers: [SignaturesService],
  exports: [SignaturesService],
})
export class SignaturesModule {}
