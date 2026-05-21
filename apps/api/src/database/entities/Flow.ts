import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Business } from './Business';
import { FlowExecution } from './FlowExecution';

export enum FlowStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum NodeType {
  START = 'START',
  SEND_MESSAGE = 'SEND_MESSAGE',
  WAIT = 'WAIT',
  CONDITION = 'CONDITION',
  AI_REPLY = 'AI_REPLY',
  TAG_CONTACT = 'TAG_CONTACT',
  HUMAN_HANDOFF = 'HUMAN_HANDOFF',
  END = 'END',
}

@Entity('flows')
export class Flow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ enum: FlowStatus, default: FlowStatus.DRAFT })
  status: FlowStatus;

  @Column('jsonb')
  nodes: Array<{
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;

  @Column('jsonb')
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;

  @Column({ type: 'int', default: 0 })
  executionCount: number;

  @Column({ type: 'int', default: 0 })
  successCount: number;

  @Column({ type: 'int', default: 0 })
  failureCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  publishedAt: Date;

  // Relations
  @ManyToOne(() => Business, (business) => business.flows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  businessId: string;

  @OneToMany(() => FlowExecution, (execution) => execution.flow)
  executions: FlowExecution[];
}
