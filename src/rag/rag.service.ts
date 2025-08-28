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
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
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
import { ConversationsService } from 'src/resources/conversations/conversations.service';

// Import your custom prompt
import { customRagPrompt } from '../prompt/rag-prompt';
import { MessageRole, MessageType } from 'src/db/entities/message.entity';

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

  constructor(
    private configService: ConfigService,
    private conversationService: ConversationsService,
  ) {
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

  // here

  // New database-backed methods
  async createConversation(userId?: string, title?: string): Promise<string> {
    const conversation = await this.conversationService.createConversation({
      userId,
      title,
    });
    return conversation.id;
  }

  async getRecentConversations(userId?: string, limit: number = 10) {
    return await this.conversationService.getRecentConversations(userId, limit);
  }

  async getConversationStats(conversationId: string) {
    return await this.conversationService.getConversationStats(conversationId);
  }

  // Modified askQuestion method to use database
  async askQuestion(
    question: string,
    conversationId?: string,
    userId?: string,
  ) {
    const startTime = Date.now();
    let currentConversationId = conversationId;

    // Create new conversation if none provided
    if (!currentConversationId) {
      currentConversationId = await this.createConversation(userId);
    }

    // Get existing conversation and build chat history
    const conversation = await this.conversationService.getConversation(
      currentConversationId,
    );
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Convert database messages to LangChain format
    const chatHistory: BaseMessage[] = conversation.messages.map((msg) =>
      msg.role === MessageRole.USER
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content),
    );

    // Process through your existing RAG graph
    const result = await this.graph.invoke({
      question,
      chat_history: chatHistory,
    });

    const processingTime = Date.now() - startTime;

    // Determine message type (you can enhance this logic)
    const messageType = this.isGreetingOrCasual(question)
      ? MessageType.CONVERSATIONAL
      : MessageType.RAG;

    // Save to database
    const messageMetadata = {
      processingTime,
      retrievedDocsCount: Array.isArray(result.context)
        ? result.context.length
        : 0,
      timestamp: new Date().toISOString(),
    };

    await this.conversationService.addMessagePair(
      currentConversationId,
      question,
      result.answer,
      {
        messageType,
        context: result.context || '',
        metadata: messageMetadata,
      },
    );

    // Update conversation title if it's the first exchange
    if (conversation.messages.length === 0 && !conversation.title) {
      const title =
        question.length > 50 ? question.substring(0, 47) + '...' : question;
      await this.conversationService.updateConversation(currentConversationId, {
        title,
      });
    }

    return {
      question,
      answer: result.answer,
      conversationId: currentConversationId,
      timestamp: new Date().toISOString(),
      processingTime,
      messageType,
      // Keep backward compatibility
      history: chatHistory,
    };
  }

  // (createConversation, getConversation, deleteConversation, etc.)

  // createConversation(): string {
  //   const conversationId = uuidv4();
  //   this.conversations.set(conversationId, {
  //     id: conversationId,
  //     messages: [],
  //     createdAt: new Date(),
  //     updatedAt: new Date(),
  //   });
  //   return conversationId;
  // }

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

  // Modified for backward compatibility but now uses database
  async askFollowUpQuestion(question: string, conversationId: string) {
    if (!(await this.conversationService.getConversation(conversationId))) {
      throw new Error('Conversation not found');
    }
    return this.askQuestion(question, conversationId);
  }

  // Modified to use database
  async getConversationHistory(
    conversationId: string,
    limit?: number,
    offset?: number,
  ) {
    const conversation =
      await this.conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messages =
      limit || offset
        ? await this.conversationService.getConversationMessages(
            conversationId,
            limit,
            offset,
          )
        : conversation.messages;

    // Return in your existing format for backward compatibility
    return {
      conversationId,
      messages: messages.map((msg) => ({
        _getType: () => (msg.role === MessageRole.USER ? 'human' : 'ai'),
        content: msg.content,
        // Include additional database fields
        id: msg.id,
        type: msg.type,
        createdAt: msg.createdAt,
        metadata: msg.metadata,
      })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  // Helper method
  private isGreetingOrCasual(input: string): boolean {
    const greetingPatterns = [
      /^(hi|hello|hey|greetings)/i,
      /^(how are you|how's it going|what's up)/i,
      /^(good morning|good afternoon|good evening)/i,
      /^(thanks|thank you|bye|goodbye)/i,
    ];

    const trimmedInput = input.trim().toLowerCase();
    return (
      greetingPatterns.some((pattern) => pattern.test(trimmedInput)) ||
      ['hi', 'hello', 'hey', 'thanks', 'bye', 'sup'].includes(trimmedInput)
    );
  }

  // async askQuestion(question: string, conversationId?: string) {
  //   let chatHistory: BaseMessage[] = [];
  //   let currentConversationId = conversationId;

  //   // If no conversation ID provided, create a new conversation
  //   if (!currentConversationId) {
  //     currentConversationId = this.createConversation();
  //   } else {
  //     // Get existing conversation history
  //     const conversation = this.conversations.get(currentConversationId);
  //     if (conversation) {
  //       chatHistory = conversation.messages;
  //     } else {
  //       // If conversation ID doesn't exist, create a new one
  //       currentConversationId = this.createConversation();
  //     }
  //   }

  //   const result = await this.graph.invoke({
  //     question,
  //     chat_history: chatHistory,
  //   });

  //   // Update conversation history
  //   const conversation = this.conversations.get(currentConversationId)!;
  //   conversation.messages = result.chat_history;
  //   conversation.updatedAt = new Date();

  //   return {
  //     question,
  //     answer: result.answer,
  //     conversationId: currentConversationId,
  //     timestamp: new Date().toISOString(),
  //     history: conversation.messages.slice(0, -2),
  //   };
  // }

  // Method to handle follow-up questions
  // async askFollowUpQuestion(question: string, conversationId: string) {
  //   if (!this.conversations.has(conversationId)) {
  //     throw new Error('Conversation not found');
  //   }

  //   return this.askQuestion(question, conversationId);
  // }

  // Get conversation history
  // getConversationHistory(conversationId: string) {
  //   const conversation = this.conversations.get(conversationId);
  //   if (!conversation) {
  //     throw new Error('Conversation not found');
  //   }

  //   return {
  //     conversationId,
  //     messages: conversation.messages,
  //     createdAt: conversation.createdAt,
  //     updatedAt: conversation.updatedAt,
  //   };
  // }

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
