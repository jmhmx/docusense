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

/**
 * Certificate status enum
 */
export enum CertificateStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
  PENDING = 'pending',
}

/**
 * Certificate revocation reason enum
 */
export enum RevocationReason {
  UNSPECIFIED = 'unspecified',
  KEY_COMPROMISE = 'key_compromise',
  AFFILIATION_CHANGED = 'affiliation_changed',
  SUPERSEDED = 'superseded',
  CESSATION_OF_OPERATION = 'cessation_of_operation',
  CERTIFICATE_HOLD = 'certificate_hold',
  REMOVE_FROM_CRL = 'remove_from_crl',
  PRIVILEGE_WITHDRAWN = 'privilege_withdrawn',
  AA_COMPROMISE = 'aa_compromise',
  SECURITY_INCIDENT = 'security_incident',
  ADMINISTRATIVE = 'administrative',
  USER_REQUESTED = 'user_requested',
}

/**
 * Entity for certificate management
 * Tracks all certificates issued in the system and their status
 */
@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', name: 'public_key_hash' })
  @Index()
  publicKeyHash: string;

  @Column({ type: 'text', name: 'key_id' })
  @Index()
  keyId: string;

  @Column({ type: 'date', name: 'valid_from' })
  validFrom: Date;

  @Column({ type: 'date', name: 'valid_until' })
  validUntil: Date;

  @Column({
    type: 'enum',
    enum: CertificateStatus,
    default: CertificateStatus.ACTIVE,
  })
  status: CertificateStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'revoked_at' })
  revokedAt: Date;

  @Column({
    type: 'enum',
    enum: RevocationReason,
    nullable: true,
    name: 'revocation_reason',
  })
  revocationReason: RevocationReason;

  @Column({ type: 'text', nullable: true, name: 'revocation_details' })
  revocationDetails: string;

  @Column({ name: 'revoked_by', nullable: true })
  revokedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Certificate fingerprint for quick verification
  @Column({ name: 'fingerprint', type: 'text' })
  @Index({ unique: true })
  fingerprint: string;

  // Certificate usage flags
  @Column({ name: 'can_sign', default: true })
  canSign: boolean;

  @Column({ name: 'can_encrypt', default: true })
  canEncrypt: boolean;

  @Column({ name: 'can_authenticate', default: true })
  canAuthenticate: boolean;

  // Security features
  @Column({ name: 'security_level', default: 'standard' })
  securityLevel: string;

  @Column({ name: 'rotation_generation', default: 0 })
  rotationGeneration: number;

  // For certificate chains
  @Column({ name: 'parent_certificate_id', nullable: true })
  parentCertificateId: string;
}
