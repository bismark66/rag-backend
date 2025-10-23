/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */
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
import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ChatGroq } from '@langchain/groq';
import { PineconeStore } from '@langchain/pinecone';
import { PineconeEmbeddings } from '@langchain/pinecone';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { ConversationsService } from 'src/resources/conversations/conversations.service';

// Import your custom prompt
import { customRagPrompt, formatApiContext } from '../../prompt/rag-prompt';
import {
  buildApiPrompt,
  buildGreetingPrompt,
} from '../../prompt/prompt-builders';
import {
  isGreetingOrCasual,
  extractResponseContent,
} from '../../common/utils/utils';
import { MessageRole, MessageType } from 'src/db/entities/message.entity';

// Import ApiService
import { ApiService } from 'src/common/utils/api.service';

import { Conversation } from './models/conversation.model';
import { ChatState } from './models/chat-state.model';
import { EmbeddingsFactory } from './embeddings.factory';
import { VectorStoreFactory } from './vector-store.factory';
import { LlmFactory } from './llm.factory';
import { QueryDecomposerService } from './query-decomposer.service';

@Injectable()
export class RagService implements OnModuleInit {
  private llm: ChatGroq;
  private embeddings: PineconeEmbeddings;
  private vectorStore: PineconeStore;
  private graph: any;
  private promptTemplate: any;
  private conversations: Map<string, Conversation>;

  constructor(
    private conversationService: ConversationsService,
    @Inject(ApiService) private readonly apiService: ApiService,
    private readonly queryDecomposer: QueryDecomposerService,
  ) {
    this.conversations = new Map();
  }

  /**
   * RagService
   * - Orchestrates the RAG + API pipeline for chat.
   * - Converts DB messages into LangChain messages, dispatches greeting flows,
   *   uses the QueryDecomposerService to split complex queries into tasks,
   *   calls ApiService for external data, and invokes the RAG graph for retrieval + generation.
   *
   * Public methods used by controllers:
   * - createConversation(userId?: string, title?: string): Promise<string>
   * - getRecentConversations(userId?: string, limit?: number)
   * - askQuestion(question: string, conversationId?: string, userId?: string)
   */

  async onModuleInit() {
    await this.initializeServices();
  }

  private async initializeServices() {
    // Use factories for LLM, embeddings, and vector store
    this.llm = LlmFactory.createDefaultLlm();
    this.embeddings = EmbeddingsFactory.createDefaultEmbeddings();
    this.vectorStore = VectorStoreFactory.createDefaultVectorStore(
      this.embeddings,
    );

    this.promptTemplate = customRagPrompt;

    // Initialize the RAG graph
    await this.initializeGraph();
  }

  // LLM-based query decomposition and reformulation is now handled by QueryDecomposerService

  private async initializeGraph() {
    // Define state using Annotation for newer LangGraph versions
    const StateAnnotation = Annotation.Root({
      question: Annotation<string>(),
      context: Annotation<any[]>(),
      answer: Annotation<string>(),
      chat_history: Annotation<BaseMessage[]>(),
      apiData: Annotation<any>(),
      requiresApiCall: Annotation<boolean>(),
      apiName: Annotation<string>(),
      apiParams: Annotation<any>(),
    });

    // No longer used: detectApiRequirement. LLM-based decomposition is now used before graph invocation.
    const detectApi = async () => ({ requiresApiCall: false });

    const callApi = async (state: ChatState & { apiParams?: any }) => {
      console.log('callApi state', state);
      if (!state.requiresApiCall || !state.apiName) return { apiData: null };

      try {
        const apiData = await this.apiService.callApi(
          state.apiName,
          (state.apiParams ?? {}) as Record<string, any>,
        );
        return { apiData };
      } catch (error) {
        console.error('API call failed:', error);
        return {
          apiData: { error: `Failed to fetch data from ${state.apiName} API` },
        };
      }
    };

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

      // format API context
      const apiContext = formatApiContext(state.apiData);

      // format chat history for context
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
        apiContext: apiContext,
        chat_history: formattedHistory,
      });

      const response = await this.llm.invoke(messages as any);
      const answerContent = extractResponseContent(response);

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
      .addNode('detectApi', detectApi)
      .addNode('callApi', callApi)
      .addNode('retrieve', retrieve)
      .addNode('generate', generate)
      .addEdge('__start__', 'detectApi')
      .addEdge('detectApi', 'callApi')
      .addEdge('callApi', 'retrieve')
      .addEdge('retrieve', 'generate')
      .addEdge('generate', '__end__')
      .compile();
  }

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

  async askQuestion(
    question: string,
    conversationId?: string,
    userId?: string,
  ) {
    const startTime = Date.now();
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = await this.createConversation(userId);
    }
    const conversation = await this.conversationService.getConversation(
      currentConversationId,
    );
    if (!conversation) throw new NotFoundException('Conversation not found');
    const chatHistory: BaseMessage[] = conversation.messages.map((msg) =>
      msg.role === MessageRole.USER
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content),
    );

    if (isGreetingOrCasual(question)) {
      return this.handleGreeting(
        question,
        currentConversationId,
        conversation,
        startTime,
      );
    }
    return this.handleDecomposed(
      question,
      currentConversationId,
      conversation,
      chatHistory,
      startTime,
    );
  }

  private async handleGreeting(
    question: string,
    conversationId: string,
    conversation: { messages: any[]; [key: string]: any },
    startTime: number,
  ) {
    const convPrompt = buildGreetingPrompt(question);
    const convResponse = await this.llm.invoke(convPrompt);
    const answer = extractResponseContent(convResponse);
    const processingTime = Date.now() - startTime;
    const messageType = MessageType.CONVERSATIONAL;
    const messageMetadata = {
      processingTime,
      retrievedDocsCount: 0,
      timestamp: new Date().toISOString(),
    };
    await this.conversationService.addMessagePair(
      conversationId,
      question,
      answer,
      {
        messageType,
        context: JSON.stringify([]),
        metadata: messageMetadata,
      },
    );
    if (conversation.messages.length === 0 && !conversation['title']) {
      const title =
        question.length > 50 ? question.substring(0, 47) + '...' : question;
      await this.conversationService.updateConversation(conversationId, {
        title,
      });
    }
    return {
      question,
      answer,
      conversationId,
      timestamp: new Date().toISOString(),
      processingTime,
      messageType,
      history: [],
    };
  }

  private async handleDecomposed(
    question: string,
    conversationId: string,
    conversation: { messages: any[]; [key: string]: any },
    chatHistory: BaseMessage[],
    startTime: number,
  ) {
    const decomposition =
      await this.queryDecomposer.decomposeAndReformulate(question);
    console.log('Decomposed Queries:', decomposition);
    const answers: string[] = [];
    const contexts: any[] = [];
    let lastResult: any = null;
    for (const q of decomposition.queries) {
      let result;
      if (q.requiresApi && q.apiName) {
        const apiData = await this.apiService.callApi(
          q.apiName,
          q.apiParams ?? {},
        );
        const isFarmingQuery =
          /plant|farming|farm|agriculture|sow|harvest|crop|season/i.test(
            q.reformulatedQuery,
          );
        const apiPrompt = buildApiPrompt({
          userQuestion: q.reformulatedQuery,
          apiData,
          isFarmingQuery,
        });
        const apiResponse = await this.llm.invoke(apiPrompt);
        const answer = extractResponseContent(apiResponse);
        result = { answer, context: [] };
      } else {
        result = await this.graph.invoke({
          question: q.reformulatedQuery,
          chat_history: chatHistory,
        });
      }
      answers.push(String(result.answer));
      if (Array.isArray(result.context))
        contexts.push(...(result.context as any[]));
      lastResult = result;
    }
    const processingTime = Date.now() - startTime;
    const messageType = MessageType.RAG;
    const messageMetadata = {
      processingTime,
      retrievedDocsCount: contexts.length,
      timestamp: new Date().toISOString(),
    };
    await this.conversationService.addMessagePair(
      conversationId,
      question,
      answers.join('\n'),
      {
        messageType,
        context: JSON.stringify(contexts),
        metadata: messageMetadata,
      },
    );
    if (conversation.messages.length === 0 && !conversation['title']) {
      const title =
        question.length > 50 ? question.substring(0, 47) + '...' : question;
      await this.conversationService.updateConversation(conversationId, {
        title,
      });
    }
    return {
      question,
      answer: answers.join('\n'),
      conversationId,
      timestamp: new Date().toISOString(),
      processingTime,
      messageType,
      history: lastResult?.chat_history || [],
    };
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
