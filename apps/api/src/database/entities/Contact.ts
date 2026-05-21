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
import { Message } from './Message';
import { Conversation } from './Conversation';

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  phoneNumber: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  avatar: string;

  @Column('simple-array', { default: '' })
  tags: string[];

  @Column({ nullable: true })
  lastMessageAt: Date;

  @Column({ type: 'int', default: 0 })
  totalMessages: number;

  @Column('jsonb', { default: {} })
  customFields: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Business, (business) => business.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  businessId: string;

  @OneToMany(() => Message, (message) => message.contact)
  messages: Message[];

  @OneToMany(() => Conversation, (conversation) => conversation.contact)
  conversations: Conversation[];
}
