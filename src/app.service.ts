import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to RAG API! 🤖 Ready to answer your questions with AI-powered document retrieval.';
  }
}