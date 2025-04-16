import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SatService } from './sat.service';
import { PacService } from './pac.service';
import { EfirmaService } from './efirma.service';
import { SatController } from './sat.controller';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [ConfigModule, CryptoModule],
  controllers: [SatController],
  providers: [SatService, PacService, EfirmaService],
  exports: [SatService, PacService, EfirmaService],
})
export class SatModule {}
