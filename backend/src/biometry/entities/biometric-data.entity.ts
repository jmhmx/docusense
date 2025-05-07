import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('biometric_data')
export class BiometricData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'bytea', name: 'descriptor_data' })
  descriptorData: Buffer;

  @Column({ name: 'iv', type: 'bytea' })
  iv: Buffer;

  @Column({ name: 'auth_tag', type: 'bytea' })
  authTag: Buffer;

  @Column({ name: 'salt', type: 'bytea', nullable: true })
  salt: Buffer;

  @Column({ type: 'enum', enum: ['face', 'fingerprint'], default: 'face' })
  type: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ nullable: true, name: 'last_verified_at' })
  lastVerifiedAt: Date;
}
