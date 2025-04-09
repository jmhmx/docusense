import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BiometryController } from './biometry.controller';
import { BiometryService } from './biometry.service';
import { BiometricData } from './entities/biometric-data.entity';
import { CryptoModule } from '../crypto/crypto.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BiometricData]),
    CryptoModule,
    UsersModule,
    AuditModule,
  ],
  controllers: [BiometryController],
  providers: [BiometryService],
  exports: [BiometryService],
})
export class BiometryModule {}
