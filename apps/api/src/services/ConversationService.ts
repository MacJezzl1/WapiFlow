import { Repository } from 'typeorm';
import { AppDataSource } from '@/database/data-source';
import { Conversation, ConversationStatus, Message, User } from '@/database/entities';
import { APIError } from '@/utils/errors';
import { socketService } from '@/services/SocketService';

export interface ConversationFilterOptions {
  status?: ConversationStatus;
  assignedToId?: string;
  hasAssignee?: boolean;
}

export class ConversationService {
  private conversationRepo: Repository<Conversation>;
  private userRepo: Repository<User>;
  private messageRepo: Repository<Message>;

  constructor() {
    this.conversationRepo = AppDataSource.getRepository(Conversation);
    this.userRepo = AppDataSource.getRepository(User);
    this.messageRepo = AppDataSource.getRepository(Message);
  }

  async getConversation(businessId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, businessId },
      relations: ['contact', 'assignedTo'],
    });

    if (!conversation) {
      throw new APIError(404, 'Conversation not found');
    }

    return conversation;
  }

  async listConversations(
    businessId: string,
    options: ConversationFilterOptions = {},
    limit = 50,
    offset = 0
  ): Promise<{
    conversations: Conversation[];
    total: number;
  }> {
    let query = this.conversationRepo
      .createQueryBuilder('conversation')
      .where('conversation.businessId = :businessId', { businessId })
      .leftJoinAndSelect('conversation.contact', 'contact')
      .leftJoinAndSelect('conversation.assignedTo', 'assignedTo');

    if (options.status) {
      query = query.andWhere('conversation.status = :status', { status: options.status });
    }

    if (options.assignedToId) {
      query = query.andWhere('conversation.assignedToId = :assignedToId', {
        assignedToId: options.assignedToId,
      });
    }

    if (options.hasAssignee === true) {
      query = query.andWhere('conversation.assignedToId IS NOT NULL');
    } else if (options.hasAssignee === false) {
      query = query.andWhere('conversation.assignedToId IS NULL');
    }

    const total = await query.getCount();
    const conversations = await query.orderBy('conversation.lastMessageAt', 'DESC').limit(limit).offset(offset).getMany();

    return { conversations, total };
  }

  async assignConversation(businessId: string, conversationId: string, assignedToId: string): Promise<Conversation> {
    const conversation = await this.getConversation(businessId, conversationId);

    // Verify user exists and belongs to the same business
    const user = await this.userRepo.findOne({
      where: { id: assignedToId, businessId },
    });

    if (!user) {
      throw new APIError(404, 'User not found or does not belong to this business');
    }

    conversation.assignedTo = user;
    conversation.assignedToId = assignedToId;
    conversation.status = ConversationStatus.ASSIGNED;

    const result = await this.conversationRepo.save(conversation);

    // Real-time update
    socketService.emitToBusiness(businessId, 'conversation_updated', {
      conversationId: conversation.id,
      status: conversation.status,
      assignedToId: assignedToId,
    });
    socketService.emitToUser(assignedToId, 'notification', {
      type: 'ASSIGNMENT',
      message: `You have been assigned to conversation ${conversation.id}`,
      conversationId: conversation.id,
    });

    return result;
  }

  async unassignConversation(businessId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.getConversation(businessId, conversationId);

    conversation.assignedTo = null;
    conversation.assignedToId = null;
    conversation.status = ConversationStatus.OPEN;

    const result = await this.conversationRepo.save(conversation);

    // Real-time update
    socketService.emitToBusiness(businessId, 'conversation_updated', {
      conversationId: conversation.id,
      status: conversation.status,
      assignedToId: null,
    });

    return result;
  }

  async resolveConversation(businessId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.getConversation(businessId, conversationId);

    conversation.status = ConversationStatus.RESOLVED;
    conversation.resolvedAt = new Date();

    const result = await this.conversationRepo.save(conversation);

    // Real-time update
    socketService.emitToBusiness(businessId, 'conversation_updated', {
      conversationId: conversation.id,
      status: conversation.status,
    });

    return result;
  }

  async archiveConversation(businessId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.getConversation(businessId, conversationId);

    conversation.status = ConversationStatus.ARCHIVED;

    return this.conversationRepo.save(conversation);
  }

  async addTag(businessId: string, conversationId: string, tag: string): Promise<Conversation> {
    const conversation = await this.getConversation(businessId, conversationId);

    if (!conversation.tags) {
      conversation.tags = [];
    }

    if (!conversation.tags.includes(tag)) {
      conversation.tags.push(tag);
      await this.conversationRepo.save(conversation);
    }

    return conversation;
  }

  async removeTag(businessId: string, conversationId: string, tag: string): Promise<Conversation> {
    const conversation = await this.getConversation(businessId, conversationId);

    if (conversation.tags) {
      conversation.tags = conversation.tags.filter((t) => t !== tag);
      await this.conversationRepo.save(conversation);
    }

    return conversation;
  }

  async getConversationHistory(businessId: string, conversationId: string): Promise<{
    conversation: Conversation;
    messages: Message[];
  }> {
    const conversation = await this.getConversation(businessId, conversationId);

    const messages = await this.messageRepo
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .where('message.businessId = :businessId', { businessId })
      .orderBy('message.createdAt', 'ASC')
      .getMany();

    return { conversation, messages };
  }

  async getStats(businessId: string): Promise<{
    openCount: number;
    assignedCount: number;
    resolvedCount: number;
    archivedCount: number;
    totalCount: number;
    averageResponseTime: number;
  }> {
    const query = this.conversationRepo.createQueryBuilder('conversation').where('conversation.businessId = :businessId', {
      businessId,
    });

    const totalCount = await query.getCount();

    const openCount = await query
      .clone()
      .andWhere('conversation.status = :status', { status: ConversationStatus.OPEN })
      .getCount();

    const assignedCount = await query
      .clone()
      .andWhere('conversation.status = :status', { status: ConversationStatus.ASSIGNED })
      .getCount();

    const resolvedCount = await query
      .clone()
      .andWhere('conversation.status = :status', { status: ConversationStatus.RESOLVED })
      .getCount();

    const archivedCount = await query
      .clone()
      .andWhere('conversation.status = :status', { status: ConversationStatus.ARCHIVED })
      .getCount();

    // TODO: Calculate average response time
    const averageResponseTime = 0;

    return {
      openCount,
      assignedCount,
      resolvedCount,
      archivedCount,
      totalCount,
      averageResponseTime,
    };
  }
}
