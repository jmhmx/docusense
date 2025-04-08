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
}
