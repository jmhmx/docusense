// backend/src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SystemConfiguration } from './entities/system-configuration.entity';
import { User } from '../users/entities/user.entity'; // Añadir importación
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { AuditModule } from '../audit/audit.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuthModule } from '../auth/auth.module'; // Añadir importación

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemConfiguration, User]), // Añadir User
    UsersModule,
    EmailModule,
    AuditModule,
    BlockchainModule,
    AuthModule, // Añadir el módulo de autenticación
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
