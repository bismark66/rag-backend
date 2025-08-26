/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGroq } from '@langchain/groq';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone as PineconeClient } from '@pinecone-database/pinecone';
import { PineconeEmbeddings } from '@langchain/pinecone';
// import { pull } from 'langchain/hub';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';

// Import your custom prompt
import { customRagPrompt } from '../prompt/rag-prompt';

interface Conversation {
  id: string;
  messages: BaseMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatState {
  question: string;
  context: any[];
  answer: string;
  chat_history: BaseMessage[];
}

@Injectable()
export class RagService implements OnModuleInit {
  private llm: ChatGroq;
  private embeddings: PineconeEmbeddings;
  private vectorStore: PineconeStore;
  private graph: any;
  private promptTemplate: any;
  private conversations: Map<string, Conversation>;

  constructor(private configService: ConfigService) {
    this.conversations = new Map();
  }

  async onModuleInit() {
    await this.initializeServices();
  }

  private async initializeServices() {
    // Initialize LLM with slightly higher temperature for natural conversation
    this.llm = new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
    });

    // Initialize embeddings
    this.embeddings = new PineconeEmbeddings({
      model: 'multilingual-e5-large',
    });

    // Initialize Pinecone
    const pinecone = new PineconeClient();
    this.vectorStore = new PineconeStore(this.embeddings, {
      pineconeIndex: pinecone.Index('test'),
      maxConcurrency: 5,
    });

    // // Load prompt template
    //     this.promptTemplate = await pull('rlm/rag-prompt');

    // Use custom prompt template instead of pulling from hub
    this.promptTemplate = customRagPrompt;

    // Initialize the RAG graph with memory
    await this.initializeGraph();
  }

  private async initializeGraph() {
    // Define state using Annotation for newer LangGraph versions
    const StateAnnotation = Annotation.Root({
      question: Annotation<string>(),
      context: Annotation<any[]>(),
      answer: Annotation<string>(),
      chat_history: Annotation<BaseMessage[]>(),
    });

    const retrieve = async (state: ChatState) => {
      const retrievedDocs = await this.vectorStore.similaritySearch(
        state.question,
        6,
      );
      return { context: retrievedDocs };
    };

    const generate = async (state: ChatState) => {
      const docsContent = state.context
        .map((doc: any) => doc.pageContent)
        .join('\n');

      // Format chat history for context
      const formattedHistory = state.chat_history
        .map((msg: BaseMessage) =>
          msg._getType() === 'human'
            ? `User: ${msg.content}`
            : `Assistant: ${msg.content}`,
        )
        .join('\n');

      const messages = await this.promptTemplate.invoke({
        question: state.question,
        context: docsContent,
        chat_history: formattedHistory,
      });

      const response = await this.llm.invoke(messages);

      // Extract string content from the response
      const answerContent =
        typeof response.content === 'string'
          ? response.content
          : Array.isArray(response.content)
            ? response.content
                .map((item: any) =>
                  typeof item === 'string'
                    ? item
                    : item.text || JSON.stringify(item),
                )
                .join(' ')
            : JSON.stringify(response.content);

      return {
        answer: answerContent,
        chat_history: [
          ...state.chat_history,
          new HumanMessage(state.question),
          new AIMessage(answerContent),
        ],
      };
    };

    this.graph = new StateGraph(StateAnnotation)
      .addNode('retrieve', retrieve)
      .addNode('generate', generate)
      .addEdge('__start__', 'retrieve')
      .addEdge('retrieve', 'generate')
      .addEdge('generate', '__end__')
      .compile();
  }

  // (createConversation, getConversation, deleteConversation, etc.)

  createConversation(): string {
    const conversationId = uuidv4();
    this.conversations.set(conversationId, {
      id: conversationId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return conversationId;
  }

  // Get conversation
  getConversation(conversationId: string): Conversation | null {
    return this.conversations.get(conversationId) || null;
  }

  // Delete conversation
  deleteConversation(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }

  // Clear conversation history but keep the conversation ID
  clearConversationHistory(conversationId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.messages = [];
      conversation.updatedAt = new Date();
      return true;
    }
    return false;
  }

  async askQuestion(question: string, conversationId?: string) {
    let chatHistory: BaseMessage[] = [];
    let currentConversationId = conversationId;

    // If no conversation ID provided, create a new conversation
    if (!currentConversationId) {
      currentConversationId = this.createConversation();
    } else {
      // Get existing conversation history
      const conversation = this.conversations.get(currentConversationId);
      if (conversation) {
        chatHistory = conversation.messages;
      } else {
        // If conversation ID doesn't exist, create a new one
        currentConversationId = this.createConversation();
      }
    }

    const result = await this.graph.invoke({
      question,
      chat_history: chatHistory,
    });

    // Update conversation history
    const conversation = this.conversations.get(currentConversationId)!;
    conversation.messages = result.chat_history;
    conversation.updatedAt = new Date();

    return {
      question,
      answer: result.answer,
      conversationId: currentConversationId,
      timestamp: new Date().toISOString(),
      history: conversation.messages.slice(0, -2),
    };
  }

  // Method to handle follow-up questions
  async askFollowUpQuestion(question: string, conversationId: string) {
    if (!this.conversations.has(conversationId)) {
      throw new Error('Conversation not found');
    }

    return this.askQuestion(question, conversationId);
  }

  // Get conversation history
  getConversationHistory(conversationId: string) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return {
      conversationId,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  async addDocuments(documents: Document[]) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const allSplits = await splitter.splitDocuments(documents);
    await this.vectorStore.addDocuments(allSplits);

    return {
      message: 'Documents added successfully',
      chunksCount: allSplits.length,
    };
  }

  async similaritySearch(query: string, k: number = 4) {
    const results = await this.vectorStore.similaritySearch(query, k);
    return results.map((doc) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
    }));
  }
}
