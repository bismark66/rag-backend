import { PineconeStore } from '@langchain/pinecone';
import { Pinecone as PineconeClient } from '@pinecone-database/pinecone';
import { PineconeEmbeddings } from '@langchain/pinecone';

export class VectorStoreFactory {
  static createDefaultVectorStore(embeddings: PineconeEmbeddings) {
    const pinecone = new PineconeClient();
    return new PineconeStore(embeddings, {
      pineconeIndex: pinecone.Index('test'),
      maxConcurrency: 5,
    });
  }
}
