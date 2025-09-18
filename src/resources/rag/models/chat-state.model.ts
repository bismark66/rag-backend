import { BaseMessage } from '@langchain/core/messages';

export interface ChatState {
  question: string;
  context: any[];
  answer: string;
  chat_history: BaseMessage[];
  apiData?: any;
  requiresApiCall?: boolean;
  apiName?: string;
}
