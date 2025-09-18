import { PineconeEmbeddings } from '@langchain/pinecone';

export class EmbeddingsFactory {
  static createDefaultEmbeddings() {
    return new PineconeEmbeddings({
      model: 'multilingual-e5-large',
    });
  }
}
