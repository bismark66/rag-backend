import { ChatGroq } from '@langchain/groq';

export class LlmFactory {
  static createDefaultLlm() {
    return new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
    });
  }
}
