import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DocumentsModule } from './documents/documents.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuditModule } from './audit/audit.module';
import { SignaturesModule } from './signatures/signatures.module';
import { SharingModule } from './sharing/sharing.module';
import { BiometryModule } from './biometry/biometry.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { SatModule } from './sat/sat.module';
import { EmailModule } from './email/email.module';
import { WebsocketModule } from './websocket/websocket.module';
import { AnnotationsModule } from './annotations/annotations.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CommentsModule } from './comments/comments.module';
import { AdminModule } from './admin/admin.module';
import { AutografaSignatureModule } from './signatures/autografa-signature.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, BlockchainModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: +config.get('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true, //cambiar a false en producción
        uuidExtension: 'pgcrypto',
        extra: {
          max: 20,
          connectionTimeoutMillis: 2000,
        },
      }),
    }),
    AuthModule,
    UsersModule,
    DocumentsModule,
    CryptoModule,
    AuditModule,
    SignaturesModule,
    SharingModule,
    BiometryModule,
    BlockchainModule,
    SatModule,
    EmailModule,
    WebsocketModule,
    AnnotationsModule,
    AnalyticsModule,
    NotificationsModule,
    CommentsModule,
    AdminModule,
    AutografaSignatureModule,
  ],
})
export class AppModule {}
