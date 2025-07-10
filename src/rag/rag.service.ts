/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { createClient } from '@supabase/supabase-js';
import { ChatGroq } from '@langchain/groq';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone as PineconeClient } from '@pinecone-database/pinecone';
import { PineconeEmbeddings } from '@langchain/pinecone';
import { pull } from 'langchain/hub';
import { Annotation, StateGraph } from '@langchain/langgraph';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

@Injectable()
export class RagService implements OnModuleInit {
  private llm: ChatGroq;
  private embeddings: PineconeEmbeddings;
  private vectorStore: PineconeStore;
  private supabaseClient: any;
  private graph: any;
  private promptTemplate: any;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeServices();
  }
  private async initializeServices() {
    // Initialize LLM
    this.llm = new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
    });

    // Initialize embeddings
    this.embeddings = new PineconeEmbeddings({
      model: 'multilingual-e5-large',
      // pineconeApiKey: this.configService.get('PINECONE_API_KEY'),
    });

    // Initialize Pinecone
    const pinecone = new PineconeClient();
    // {
    // apiKey: this.configService.get('PINECONE_API_KEY'),
    // }

    this.vectorStore = new PineconeStore(this.embeddings, {
      pineconeIndex: pinecone.Index('test'),
      maxConcurrency: 5,
    });

    // Initialize Supabase client
    this.supabaseClient = createClient(
      'postgresql://postgres:S36t31ntdt30ql0J@db.cuxdaqoddspsotnkumse.supabase.co:5432/postgres',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eGRhcW9kZHNwc290bmt1bXNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTUwMDU2OCwiZXhwIjoyMDY3MDc2NTY4fQ.DK0RWFMmIyaPfe7CxRqyzY-UQwS9_DRcFvToACnm5zc',
    );
    // this.configService.get('SUPABASE_URL'),
    // this.configService.get('SUPABASE_SERVICE_KEY'),

    // Load prompt template
    this.promptTemplate = await pull('rlm/rag-prompt');

    // Initialize the RAG graph
    await this.initializeGraph();
  }

  private async initializeGraph() {
    const StateAnnotation = Annotation.Root({
      question: Annotation(),
      context: Annotation(),
      answer: Annotation(),
    });

    const retrieve = async (state: any) => {
      const retrievedDocs = await this.vectorStore.similaritySearch(
        state.question,
      );
      return { context: retrievedDocs };
    };

    const generate = async (state: any) => {
      const docsContent = state.context
        .map((doc: any) => doc.pageContent)
        .join('\n');
      const messages = await this.promptTemplate.invoke({
        question: state.question,
        context: docsContent,
      });
      const response = await this.llm.invoke(messages);
      return { answer: response.content };
    };

    this.graph = new StateGraph(StateAnnotation)
      .addNode('retrieve', retrieve)
      .addNode('generate', generate)
      .addEdge('__start__', 'retrieve')
      .addEdge('retrieve', 'generate')
      .addEdge('generate', '__end__')
      .compile();
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

  async askQuestion(question: string) {
    const result = await this.graph.invoke({ question });
    return {
      question,
      answer: result.answer,
      timestamp: new Date().toISOString(),
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
