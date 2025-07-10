/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { Document } from '@langchain/core/documents';
import { RagService } from '../rag/rag.service';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
// import { CheerioWebBaseLoader } from 'langchain/document_loaders/web/cheerio';
// import { SelectorType } from '@langchain/community/document_loaders/web/cheerio';
import type { SelectorType } from 'cheerio';

@Injectable()
export class DocumentsService {
  constructor(private readonly ragService: RagService) {}

  async ingestFromUrl(url: string, selector: string = 'p') {
    const loader = new CheerioWebBaseLoader(url, {
      selector: selector as unknown as SelectorType,
    });
    const docs = await loader.load();

    return this.ragService.addDocuments(docs);
  }

  async ingestText(texts: string[]) {
    const docs = texts.map(
      (text, index) =>
        new Document({
          pageContent: text,
          metadata: {
            source: `text-${index}`,
            timestamp: new Date().toISOString(),
          },
        }),
    );

    return this.ragService.addDocuments(docs);
  }

  async searchSimilar(query: string, k: number = 4) {
    return this.ragService.similaritySearch(query, k);
  }
}
