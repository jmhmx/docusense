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
import { Document } from '../../documents/entities/document.entity';
import { PermissionLevel } from './document-permission.entity';

@Entity('share_links')
export class ShareLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  token: string;

  @Column({ name: 'document_id' })
  @Index()
  documentId: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({
    type: 'enum',
    enum: PermissionLevel,
    default: PermissionLevel.VIEWER,
  })
  permissionLevel: PermissionLevel;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  requiresPassword: boolean;

  @Column({ nullable: true })
  passwordHash: string;

  @Column({ default: 0 })
  accessCount: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  maxUses: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ nullable: true, type: 'jsonb' })
  metadata: Record<string, any>;
}
