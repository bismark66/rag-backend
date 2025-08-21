/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { RagService } from '../rag/rag.service';

@Injectable()
export class ChatService {
  constructor(private readonly ragService: RagService) {}

  async askQuestion(question: string) {
    console.log(question);
    return this.ragService.askQuestion(question);
  }

  async askFollowUpQuestion(question: string, conversationId: string) {
    return this.ragService.askFollowUpQuestion(question, conversationId);
  }

  async getConversationHistory(conversationId: string) {
    return this.ragService.getConversationHistory(conversationId);
  }
}
