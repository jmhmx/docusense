// backend/src/comments/entities/comment.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Document } from '../../documents/entities/document.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  parentId?: string;

  @OneToMany(() => Comment, (comment) => comment.parent)
  replies: Comment[];

  @ManyToOne(() => Comment, (comment) => comment.replies, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Comment;

  @Column({ default: false })
  isResolved: boolean;

  @Column({ nullable: true })
  resolvedBy?: string;

  @Column({ nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  position?: Record<string, any>;

  // Nuevos campos para menciones y otras funcionalidades
  @Column({ type: 'simple-array', nullable: true })
  mentions?: string[]; // IDs de usuarios mencionados

  @Column({ default: false })
  isPrivate: boolean;

  @Column({ default: false })
  hasAttachment: boolean;

  @Column({ nullable: true })
  attachmentUrl?: string;

  @Column({ type: 'simple-array', nullable: true })
  readBy?: string[]; // IDs de usuarios que han leído el comentario

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
