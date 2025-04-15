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
        synchronize: true,
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
  ],
})
export class AppModule {}
