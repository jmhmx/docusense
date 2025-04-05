import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { AuditAction } from '../audit-log.service';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
  })
  @Index()
  action: AuditAction;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'resource_id', nullable: true })
  @Index()
  resourceId?: string;

  @Column({ nullable: true, name: 'ip_address' })
  ipAddress?: string;

  @Column({ nullable: true, name: 'user_agent' })
  userAgent?: string;

  @Column({ type: 'timestamp' })
  @Index()
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, any>;
}
