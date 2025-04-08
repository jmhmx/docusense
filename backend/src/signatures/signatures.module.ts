import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignaturesService } from './signatures.service';
import { SignaturesController } from './signatures.controller';
import { Signature } from './entities/signature.entity';
import { CryptoModule } from '../crypto/crypto.module';
import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Signature]),
    CryptoModule,
    DocumentsModule,
    UsersModule,
    AuditModule, // Añadido el módulo de auditoría
  ],
  controllers: [SignaturesController],
  providers: [SignaturesService],
  exports: [SignaturesService],
})
export class SignaturesModule {}
