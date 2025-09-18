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
// import { Pinecone as PineconeClient } from '@pinecone-database/pinecone';
import { PineconeEmbeddings } from '@langchain/pinecone';
// import { pull } from 'langchain/hub';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { ConversationsService } from 'src/resources/conversations/conversations.service';

// Import your custom prompt
import { customRagPrompt, formatApiContext } from '../../prompt/rag-prompt';
import { MessageRole, MessageType } from 'src/db/entities/message.entity';

// Import ApiService
import { ApiService } from 'src/common/utils/api.service';

import { Conversation } from './models/conversation.model';
import { ChatState } from './models/chat-state.model';
import { EmbeddingsFactory } from './embeddings.factory';
import { VectorStoreFactory } from './vector-store.factory';
import { LlmFactory } from './llm.factory';

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
  ) {
    this.conversations = new Map();
  }

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

    // Use custom prompt template instead of pulling from hub
    this.promptTemplate = customRagPrompt;

    // Initialize the RAG graph with memory
    await this.initializeGraph();
  }

  // Add API detection method
  private extractCityFromQuestion(question: string): string {
    const questionLower = question.toLowerCase();

    // List of common location prepositions
    const locationPrepositions = ['in', 'at', 'for', 'of', 'near'];

    // Common weather-related words that might follow a city name
    const weatherWords = [
      'weather',
      'temperature',
      'forecast',
      'humidity',
      'wind',
      'rain',
      'cloud',
      'today',
      'tomorrow',
      'per',
      'the',
    ];

    const words = questionLower.split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      if (
        locationPrepositions.includes(words[i].toLowerCase()) &&
        i + 1 < words.length
      ) {
        // Found a preposition, now collect the city name
        const cityWords: string[] = [];
        let j = i + 1;

        // Collect words until we hit a weather-related word or end of sentence
        while (
          j < words.length &&
          !weatherWords.includes(words[j].toLowerCase().replace(/[.,?]/g, ''))
        ) {
          cityWords.push(words[j]);
          j++;
        }

        if (cityWords.length > 0) {
          const potentialCity = cityWords
            .join(' ')
            .replace(/[.,?]/g, '')
            .trim();

          // Basic validation - city should be 1-3 words typically
          if (
            potentialCity.length > 1 &&
            potentialCity.split(' ').length <= 3
          ) {
            return potentialCity;
          }
        }
      }
    }

    // If no city found with preposition pattern, look for direct mentions
    const directPattern =
      /(weather|temperature|forecast|rain)\s+in\s+([a-zA-Z\s]+?)(?=\s|\.|\?|$)/i;
    const directMatch = question.match(directPattern);
    if (directMatch && directMatch[2]) {
      return directMatch[2].trim();
    }

    return '';
  }

  private detectApiRequirement(question: string): {
    requiresApi: boolean;
    apiName?: string;
    params?: any;
  } {
    const questionLower = question.toLowerCase();

    // Weather-related queries
    if (
      questionLower.includes('weather') ||
      questionLower.includes('temperature') ||
      questionLower.includes('forecast') ||
      questionLower.includes('humidity') ||
      questionLower.includes('wind') ||
      questionLower.includes('rain') ||
      questionLower.includes('cloud')
    ) {
      const city = this.extractCityFromQuestion(question);
      console.log('Extracted city:', city);

      if (!city) {
        return { requiresApi: false };
      }

      return {
        requiresApi: true,
        apiName: 'weather',
        params: {
          city: city,
        },
      };
    }

    // News-related queries
    if (
      questionLower.includes('news') ||
      questionLower.includes('headlines') ||
      questionLower.includes('latest news')
    ) {
      return {
        requiresApi: true,
        apiName: 'news',
        params: {
          country: 'us',
          pageSize: 5,
        },
      };
    }

    return { requiresApi: false };
  }

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

    const detectApi = async (state: ChatState) => {
      const apiDetection = this.detectApiRequirement(state.question);
      console.log('apiDetection', apiDetection);
      return {
        requiresApiCall: apiDetection.requiresApi,
        apiName: apiDetection.apiName,
        ...(apiDetection.params && { apiParams: apiDetection.params }),
      };
    };

    const callApi = async (state: ChatState & { apiParams?: any }) => {
      console.log('callApi state', state);
      if (!state.requiresApiCall || !state.apiName) {
        return { apiData: null };
      }

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

      // Format API context safely
      const apiContext = formatApiContext(state.apiData);

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
        apiContext: apiContext,
        chat_history: formattedHistory,
      });

      const response = await this.llm.invoke(messages as any); // TODO: Refine type for messages
      const answerContent = this.extractResponseContent(response);

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
      result.answer as string,
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

  private extractResponseContent(response: any): string {
    if (typeof response.content === 'string') {
      return response.content;
    } else if (Array.isArray(response.content)) {
      return response.content
        .map((item: any) =>
          typeof item === 'string' ? item : item.text || JSON.stringify(item),
        )
        .join(' ');
    } else {
      return JSON.stringify(response.content);
    }
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
