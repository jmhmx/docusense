// backend/src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SystemConfiguration } from './entities/system-configuration.entity';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { AuditModule } from '../audit/audit.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemConfiguration]),
    UsersModule,
    EmailModule,
    AuditModule,
    BlockchainModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
