import { BaseMessage } from '@langchain/core/messages';

export interface Conversation {
  id: string;
  messages: BaseMessage[];
  createdAt: Date;
  updatedAt: Date;
}
