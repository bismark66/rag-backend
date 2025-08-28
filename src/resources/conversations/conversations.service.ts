/* eslint-disable @typescript-eslint/no-unsafe-call */
// conversation/conversation.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from 'src/db/entities/conversations.entity';
import {
  Message,
  MessageRole,
  MessageType,
} from 'src/db/entities/message.entity';

export interface CreateConversationDto {
  title?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface CreateMessageDto {
  conversationId: string;
  role: MessageRole;
  content: string;
  type?: MessageType;
  context?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async createConversation(
    dto: CreateConversationDto = {},
  ): Promise<Conversation> {
    const conversation = this.conversationRepository.create({
      title: dto.title,
      userId: dto.userId,
      metadata: dto.metadata ? JSON.stringify(dto.metadata) : undefined,
    });

    return await this.conversationRepository.save(conversation);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return await this.conversationRepository.findOne({
      where: { id },
      relations: ['messages'],
      order: {
        messages: {
          createdAt: 'ASC',
        },
      },
    });
  }

  async updateConversation(
    id: string,
    updates: Partial<CreateConversationDto>,
  ): Promise<Conversation | null> {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
    });

    if (!conversation) {
      return null;
    }

    if (updates.title !== undefined) conversation.title = updates.title;
    if (updates.userId !== undefined) conversation.userId = updates.userId;
    if (updates.metadata !== undefined) {
      conversation.metadata = JSON.stringify(updates.metadata);
    }

    return await this.conversationRepository.save(conversation);
  }

  async deleteConversation(id: string): Promise<boolean> {
    const result = await this.conversationRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async addMessage(dto: CreateMessageDto): Promise<Message> {
    const message = this.messageRepository.create({
      conversationId: dto.conversationId,
      role: dto.role,
      content: dto.content,
      type: dto.type || MessageType.RAG,
      context: dto.context,
      metadata: dto.metadata,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update conversation's updatedAt timestamp
    await this.conversationRepository.update(dto.conversationId, {
      updatedAt: new Date(),
    });

    return savedMessage;
  }

  async addMessagePair(
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    options: {
      messageType?: MessageType;
      context?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<{ userMsg: Message; assistantMsg: Message }> {
    // Add user message
    const userMsg = await this.addMessage({
      conversationId,
      role: MessageRole.USER,
      content: userMessage,
      type: options.messageType,
      metadata: options.metadata,
    });

    // Add assistant message
    const assistantMsg = await this.addMessage({
      conversationId,
      role: MessageRole.ASSISTANT,
      content: assistantMessage,
      type: options.messageType,
      context: options.context,
      metadata: options.metadata,
    });

    return { userMsg, assistantMsg };
  }

  async getConversationMessages(
    conversationId: string,
    limit?: number,
    offset?: number,
  ): Promise<Message[]> {
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.createdAt', 'ASC');

    if (limit) {
      queryBuilder.limit(limit);
    }

    if (offset) {
      queryBuilder.offset(offset);
    }

    return await queryBuilder.getMany();
  }

  async clearConversationMessages(conversationId: string): Promise<boolean> {
    const result = await this.messageRepository.delete({ conversationId });

    // Update conversation's updatedAt timestamp
    await this.conversationRepository.update(conversationId, {
      updatedAt: new Date(),
    });

    return (result.affected ?? 0) > 0;
  }

  async getRecentConversations(
    userId?: string,
    limit: number = 10,
  ): Promise<Conversation[]> {
    const queryBuilder = this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.messages', 'messages')
      .orderBy('conversation.updatedAt', 'DESC')
      .limit(limit);

    if (userId) {
      queryBuilder.where('conversation.userId = :userId', { userId });
    }

    return await queryBuilder.getMany();
  }

  async getConversationStats(conversationId: string) {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      return null;
    }

    const messageCount = conversation.messages.length;
    const userMessages = conversation.messages.filter(
      (m) => m.role === MessageRole.USER,
    ).length;
    const assistantMessages = conversation.messages.filter(
      (m) => m.role === MessageRole.ASSISTANT,
    ).length;
    const ragMessages = conversation.messages.filter(
      (m) => m.type === MessageType.RAG,
    ).length;
    const conversationalMessages = conversation.messages.filter(
      (m) => m.type === MessageType.CONVERSATIONAL,
    ).length;

    return {
      id: conversationId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount,
      userMessages,
      assistantMessages,
      ragMessages,
      conversationalMessages,
      duration:
        conversation.updatedAt.getTime() - conversation.createdAt.getTime(),
    };
  }
}
