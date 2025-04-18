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

export enum SatResponseStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('sat_responses')
export class SatResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  uuid: string;

  @Column({ nullable: true })
  folio: string;

  @Column({
    type: 'enum',
    enum: SatResponseStatus,
    default: SatResponseStatus.RECEIVED,
  })
  status: SatResponseStatus;

  @Column()
  documentType: string;

  @Column({ type: 'jsonb' })
  responseData: Record<string, any>;

  @Column({ nullable: true })
  acuseUrl: string;

  @Column({ nullable: true, type: 'timestamp' })
  processedAt: Date;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
