import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './User';
import { Contact } from './Contact';
import { Message } from './Message';
import { Conversation } from './Conversation';
import { Flow } from './Flow';
import { Template } from './Template';
import { AuditLog } from './AuditLog';

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ unique: true })
  subdomain: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  description: string;

  @Column('jsonb', { default: {} })
  settings: Record<string, unknown>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  totalMessages: number;

  @Column({ type: 'int', default: 0 })
  totalContacts: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => User, (user) => user.business)
  users: User[];

  @OneToMany(() => Contact, (contact) => contact.business)
  contacts: Contact[];

  @OneToMany(() => Message, (message) => message.business)
  messages: Message[];

  @OneToMany(() => Conversation, (conversation) => conversation.business)
  conversations: Conversation[];

  @OneToMany(() => Flow, (flow) => flow.business)
  flows: Flow[];

  @OneToMany(() => Template, (template) => template.business)
  templates: Template[];

  @OneToMany(() => AuditLog, (log) => log.business)
  auditLogs: AuditLog[];
}
