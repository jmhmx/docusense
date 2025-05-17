import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignaturesModule } from './signatures.module';
import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';
import { CryptoModule } from '../crypto/crypto.module';
import { AuditModule } from '../audit/audit.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { EmailModule } from '../email/email.module';
import { Document } from '../documents/entities/document.entity';
import { Signature } from './entities/signature.entity';
import { AutografaSignatureService } from './autografa-signature.service';
import { AutografaSignatureController } from './autografa-signature.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Signature, Document]),
    DocumentsModule,
    UsersModule,
    CryptoModule,
    AuditModule,
    BlockchainModule,
    EmailModule,
  ],
  controllers: [AutografaSignatureController],
  providers: [AutografaSignatureService],
  exports: [AutografaSignatureService],
})
export class AutografaSignatureModule {}
