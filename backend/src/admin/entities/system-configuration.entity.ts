// backend/src/admin/entities/system-configuration.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_configurations')
export class SystemConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb', nullable: true })
  emailConfig: {
    fromEmail: string;
    smtpServer: string;
    smtpPort: number;
    useSSL: boolean;
    username: string;
    password?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  securityConfig: {
    jwtExpirationHours: number;
    maxLoginAttempts: number;
    passwordMinLength: number;
    requireStrongPasswords: boolean;
    twoFactorAuthEnabled: boolean;
    keyRotationDays: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  storageConfig: {
    maxFileSizeMB: number;
    totalStorageGB: number;
    allowedFileTypes: string[];
    documentExpirationDays: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  blockchainConfig: {
    enabled: boolean;
    provider: string;
    apiKey?: string;
    networkId: string;
  };

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
