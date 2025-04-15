import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ default: false })
  isAdmin: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ nullable: true })
  twoFactorSecret: string;

  @Column({ nullable: true })
  twoFactorTempSecret: string;

  @Column({ nullable: true })
  twoFactorTempSecretExpires: Date;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ type: 'simple-array', nullable: true })
  twoFactorRecoveryCodes: string[];

  @Column({ default: false })
  biometricAuthEnabled: boolean;

  @Column({ nullable: true })
  biometricAuthMethod: string;

  @Column({ nullable: true, name: 'biometric_auth_setup_at' })
  biometricAuthSetupAt: Date;

  // Nuevos campos para la rotación de claves
  @Column({ nullable: true, name: 'key_created_at' })
  keyCreatedAt: Date;

  @Column({ default: 0, name: 'key_rotation_count' })
  keyRotationCount: number;

  @Column({ nullable: true, name: 'last_key_rotation' })
  lastKeyRotation: Date;

  @Column({ default: false, name: 'force_key_rotation' })
  forceKeyRotation: boolean;

  @Column({ nullable: true, name: 'key_expires_at' })
  keyExpiresAt: Date;
}
