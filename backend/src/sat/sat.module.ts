import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SatService } from './sat.service';
import { PacService } from './pac.service';
import { EfirmaService } from './efirma.service';
import { SatController } from './sat.controller';
import { CryptoModule } from '../crypto/crypto.module';
import { SatTransaction } from './entities/sat-transaction.entity';
import { SatResponse } from './entities/sat-response.entity';
import { SatAcuse } from './entities/sat-acuse.entity';
import { SatListenerService } from './sat-listener.service';
import { SatNotificationService } from './sat-notification.service';
import { SatTransactionService } from './sat-transaction.service';
import { TokenService } from './token.service';
import { EmailModule } from '../email/email.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    ConfigModule,
    CryptoModule,
    TypeOrmModule.forFeature([SatTransaction, SatResponse, SatAcuse]),
    EmailModule,
    WebsocketModule,
  ],
  controllers: [SatController],
  providers: [
    SatService,
    PacService,
    EfirmaService,
    SatListenerService,
    SatNotificationService,
    SatTransactionService,
    TokenService,
  ],
  exports: [
    SatService,
    PacService,
    EfirmaService,
    SatListenerService,
    SatNotificationService,
    SatTransactionService,
    TokenService,
  ],
})
export class SatModule {}
