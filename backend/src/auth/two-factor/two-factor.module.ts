import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';
import { UsersModule } from '../../users/users.module';
import { User } from '../../users/entities/user.entity';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UsersModule, AuditModule],
  controllers: [TwoFactorController],
  providers: [TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
