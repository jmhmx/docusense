// backend/src/sat/entities/sat-transaction.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TransactionStatus {
  CREATED = 'created',
  SUBMITTED = 'submitted',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  ERROR = 'error',
}

@Entity('sat_transactions')
export class SatTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tramiteId: string;

  @Column()
  type: string; // CFDI, declaración, etc.

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.CREATED,
  })
  status: TransactionStatus;

  @Column({ nullable: true })
  folio: string;

  @Column({ type: 'jsonb' })
  data: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  submissionData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  responseData: Record<string, any>;

  @Column({ nullable: true })
  acuseId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'jsonb', default: [] })
  statusHistory: Array<{
    status: TransactionStatus;
    timestamp: string;
    message?: string;
  }>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
