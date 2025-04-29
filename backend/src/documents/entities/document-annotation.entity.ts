import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class DocumentAnnotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @Column()
  userId: string;

  @Column()
  type: string;

  @Column()
  page: number;

  @Column({ type: 'jsonb' })
  position: { x: number; y: number };

  @Column()
  content: string;

  @Column({ default: "#FFEB3B" })
  color: string;

  @CreateDateColumn()
  created: Date;
}