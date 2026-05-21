import { Repository } from 'typeorm';
import { AppDataSource } from '@/database/data-source';
import { Message, MessageDirection, MessageStatus, MessageType, Contact, Conversation } from '@/database/entities';
import { APIError } from '@/utils/errors';
import { socketService } from '@/services/SocketService';

export interface SendMessagePayload {
  contactId: string;
  content: string;
  type?: MessageType;
  metadata?: Record<string, unknown>;
}

export interface MessageFilterOptions {
  contactId?: string;
  conversationId?: string;
  direction?: MessageDirection;
  status?: MessageStatus;
  type?: MessageType;
  startDate?: Date;
  endDate?: Date;
}

export class MessageService {
  private messageRepo: Repository<Message>;
  private contactRepo: Repository<Contact>;
  private conversationRepo: Repository<Conversation>;

  constructor() {
    this.messageRepo = AppDataSource.getRepository(Message);
    this.contactRepo = AppDataSource.getRepository(Contact);
    this.conversationRepo = AppDataSource.getRepository(Conversation);
  }

  async sendMessage(businessId: string, payload: SendMessagePayload): Promise<Message> {
    // Verify contact exists
    const contact = await this.contactRepo.findOne({
      where: { id: payload.contactId, businessId },
    });

    if (!contact) {
      throw new APIError(404, 'Contact not found');
    }

    // Get or create conversation
    let conversation = await this.conversationRepo.findOne({
      where: { contactId: payload.contactId, businessId },
    });

    if (!conversation) {
      conversation = this.conversationRepo.create({
        contactId: payload.contactId,
        businessId,
        messageCount: 0,
      });
      await this.conversationRepo.save(conversation);
    }

    // Create message
    const message = this.messageRepo.create({
      externalId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.SENT,
      type: payload.type || MessageType.TEXT,
      content: payload.content,
      metadata: payload.metadata || {},
      businessId,
      contactId: payload.contactId,
      conversationId: conversation.id,
      sentAt: new Date(),
    });

    await this.messageRepo.save(message);

    // Update conversation
    conversation.messageCount++;
    conversation.lastMessageAt = new Date();
    await this.conversationRepo.save(conversation);

    // Update contact
    contact.lastMessageAt = new Date();
    contact.totalMessages++;
    await this.contactRepo.save(contact);

    // Real-time update
    socketService.emitToBusiness(businessId, 'new_message', {
      message,
      conversationId: conversation.id,
    });

    return message;
  }

  async receiveMessage(
    businessId: string,
    contactPhone: string,
    content: string,
    externalId: string,
    type?: MessageType,
    metadata?: Record<string, unknown>
  ): Promise<Message> {
    // Get or create contact
    let contact = await this.contactRepo.findOne({
      where: { phoneNumber: contactPhone, businessId },
    });

    if (!contact) {
      contact = this.contactRepo.create({
        phoneNumber: contactPhone,
        businessId,
        totalMessages: 0,
      });
      await this.contactRepo.save(contact);
    }

    // Get or create conversation
    let conversation = await this.conversationRepo.findOne({
      where: { contactId: contact.id, businessId },
    });

    if (!conversation) {
      conversation = this.conversationRepo.create({
        contactId: contact.id,
        businessId,
        messageCount: 0,
      });
      await this.conversationRepo.save(conversation);
    }

    // Create message
    const message = this.messageRepo.create({
      externalId,
      direction: MessageDirection.INBOUND,
      status: MessageStatus.DELIVERED,
      type: type || MessageType.TEXT,
      content,
      metadata: metadata || {},
      businessId,
      contactId: contact.id,
      conversationId: conversation.id,
    });

    await this.messageRepo.save(message);

    // Update conversation
    conversation.messageCount++;
    conversation.lastMessageAt = new Date();
    await this.conversationRepo.save(conversation);

    // Update contact
    contact.lastMessageAt = new Date();
    contact.totalMessages++;
    await this.contactRepo.save(contact);

    // Real-time update
    socketService.emitToBusiness(businessId, 'new_message', {
      message,
      conversationId: conversation.id,
    });

    return message;
  }

  async getMessage(businessId: string, messageId: string): Promise<Message> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId, businessId },
      relations: ['contact', 'conversation'],
    });

    if (!message) {
      throw new APIError(404, 'Message not found');
    }

    return message;
  }

  async listMessages(businessId: string, options: MessageFilterOptions = {}, limit = 50, offset = 0): Promise<{
    messages: Message[];
    total: number;
  }> {
    let query = this.messageRepo
      .createQueryBuilder('message')
      .where('message.businessId = :businessId', { businessId });

    if (options.contactId) {
      query = query.andWhere('message.contactId = :contactId', { contactId: options.contactId });
    }

    if (options.conversationId) {
      query = query.andWhere('message.conversationId = :conversationId', {
        conversationId: options.conversationId,
      });
    }

    if (options.direction) {
      query = query.andWhere('message.direction = :direction', { direction: options.direction });
    }

    if (options.status) {
      query = query.andWhere('message.status = :status', { status: options.status });
    }

    if (options.type) {
      query = query.andWhere('message.type = :type', { type: options.type });
    }

    if (options.startDate) {
      query = query.andWhere('message.createdAt >= :startDate', { startDate: options.startDate });
    }

    if (options.endDate) {
      query = query.andWhere('message.createdAt <= :endDate', { endDate: options.endDate });
    }

    const total = await query.getCount();
    const messages = await query.orderBy('message.createdAt', 'DESC').limit(limit).offset(offset).getMany();

    return { messages, total };
  }

  async searchMessages(businessId: string, query: string, limit = 50): Promise<Message[]> {
    return this.messageRepo
      .createQueryBuilder('message')
      .where('message.businessId = :businessId', { businessId })
      .andWhere('message.content ILIKE :query', { query: `%${query}%` })
      .orderBy('message.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async updateMessageStatus(businessId: string, messageId: string, status: MessageStatus): Promise<Message> {
    const message = await this.getMessage(businessId, messageId);

    message.status = status;

    if (status === MessageStatus.DELIVERED) {
      message.deliveredAt = new Date();
    } else if (status === MessageStatus.READ) {
      message.readAt = new Date();
    }

    return this.messageRepo.save(message);
  }

  async deleteMessage(businessId: string, messageId: string): Promise<void> {
    const message = await this.getMessage(businessId, messageId);
    await this.messageRepo.remove(message);
  }

  async getConversationMessages(
    businessId: string,
    conversationId: string,
    limit = 100
  ): Promise<Message[]> {
    return this.messageRepo
      .createQueryBuilder('message')
      .where('message.businessId = :businessId', { businessId })
      .andWhere('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.createdAt', 'ASC')
      .limit(limit)
      .getMany();
  }

  async getStats(businessId: string): Promise<{
    totalMessages: number;
    inboundCount: number;
    outboundCount: number;
    averageResponseTime: number;
  }> {
    const query = this.messageRepo.createQueryBuilder('message').where('message.businessId = :businessId', {
      businessId,
    });

    const totalMessages = await query.getCount();

    const inboundCount = await query
      .clone()
      .andWhere('message.direction = :direction', { direction: MessageDirection.INBOUND })
      .getCount();

    const outboundCount = totalMessages - inboundCount;

    // TODO: Calculate average response time
    const averageResponseTime = 0;

    return {
      totalMessages,
      inboundCount,
      outboundCount,
      averageResponseTime,
    };
  }
}
