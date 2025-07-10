import { Injectable } from '@nestjs/common';
import { RagService } from '../rag/rag.service';

@Injectable()
export class ChatService {
  constructor(private readonly ragService: RagService) {}

  async askQuestion(question: string) {
    return this.ragService.askQuestion(question);
  }
}