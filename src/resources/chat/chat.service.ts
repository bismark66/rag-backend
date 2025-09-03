/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { RagService } from '../rag/rag.service';

@Injectable()
export class ChatService {
  constructor(private readonly ragService: RagService) {}

  async askQuestion(question: string, userId?: string) {
    console.log(question);
    // This will create a new conversation and save to database
    return this.ragService.askQuestion(question, undefined, userId);
  }

  async askFollowUpQuestion(question: string, conversationId: string) {
    // This will continue existing conversation and save to database
    return this.ragService.askQuestion(question, conversationId);
  }

  async getConversationHistory(
    conversationId: string,
    limit?: number,
    offset?: number,
  ) {
    return this.ragService.getConversationHistory(
      conversationId,
      limit,
      offset,
    );
  }

  // new
  async createConversation(userId?: string, title?: string) {
    return this.ragService.createConversation(userId, title);
  }

  async deleteConversation(conversationId: string) {
    return this.ragService.deleteConversation(conversationId);
  }

  async clearConversationHistory(conversationId: string) {
    return this.ragService.clearConversationHistory(conversationId);
  }

  async getRecentConversations(userId?: string, limit: number = 10) {
    return this.ragService.getRecentConversations(userId, limit);
  }

  async getConversationStats(conversationId: string) {
    return this.ragService.getConversationStats(conversationId);
  }
}
