import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Flow } from './Flow';
import { Contact } from './Contact';
import { Business } from './Business';

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED',
}

@Entity('flow_executions')
export class FlowExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ enum: ExecutionStatus, default: ExecutionStatus.PENDING })
  status: ExecutionStatus;

  @Column({ type: 'int', default: 0 })
  currentNodeIndex: number;

  @Column('jsonb', { default: {} })
  variables: Record<string, unknown>;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true })
  error: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Flow, (flow) => flow.executions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flowId' })
  flow: Flow;

  @Column()
  flowId: string;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contactId' })
  contact: Contact;

  @Column()
  contactId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  businessId: string;
}
