import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SatResponse } from './sat-response.entity';

@Entity('sat_acuses')
export class SatAcuse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  responseId: string;

  @ManyToOne(() => SatResponse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'response_id' })
  response: SatResponse;

  @Column()
  filename: string;

  @Column()
  filePath: string;

  @Column()
  mimeType: string;

  @Column()
  fileSize: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
