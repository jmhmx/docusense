import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoService } from './crypto.service';
import { KeyStorageService } from './key-storage.service';
import { KeyRotationService } from './key-rotation.service';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.controller';
import { SecureCommunicationService } from './secure-communication.service';
import { SecureCommunicationController } from './secure-communication.controller';
import { User } from '../users/entities/user.entity';
import { Certificate } from './entities/certificate.entity';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, Certificate]),
    AuditModule,
    UsersModule,
  ],
  providers: [
    CryptoService,
    KeyStorageService,
    KeyRotationService,
    CertificateService,
    SecureCommunicationService,
  ],
  controllers: [CertificateController, SecureCommunicationController],
  exports: [CryptoService, KeyStorageService],
})
export class CryptoModule {}
