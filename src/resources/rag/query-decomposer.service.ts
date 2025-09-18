/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Inject, Injectable } from '@nestjs/common';

import { ChatGroq } from '@langchain/groq';
import { queryDecomposerPrompt } from '../../prompt/query-decomposer-prompt';

@Injectable()
export class QueryDecomposerService {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  constructor(@Inject(ChatGroq) private readonly llm: ChatGroq) {}

  async decomposeAndReformulate(query: string): Promise<{
    queries: Array<{
      reformulatedQuery: string;
      requiresApi: boolean;
      apiName?: string;
      apiParams?: any;
    }>;
  }> {
    const prompt = `${queryDecomposerPrompt}\nUser query: """${query}"""`;
    try {
      const response = await this.llm.invoke([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ]);
      let content = '';
      if (typeof response.content === 'string') {
        content = response.content;
      } else if (Array.isArray(response.content)) {
        // If the LLM returns an array of message parts, join them
        content = response.content
          .map((c: any) => (typeof c === 'string' ? c : c.text || ''))
          .join('');
      } else if (
        response.content &&
        typeof response.content === 'object' &&
        'text' in response.content
      ) {
        content = (response.content as any).text;
      }
      // Strip markdown/code fencing if present
      if (content.trim().startsWith('```')) {
        content = content
          .replace(/```(json)?/gi, '')
          .replace(/```/g, '')
          .trim();
      }
      //   console.log('LLM raw output:', content);
      // Extract the first valid JSON array or object from the output
      const jsonMatch = content.match(/(\[.*?\]|\{.*?\})/s);
      let arr: Array<{
        reformulatedQuery: string;
        requiresApi: boolean;
        apiName?: string;
        apiParams?: any;
      }> = [];
      if (jsonMatch) {
        arr = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('No valid JSON found in LLM output');
      }
      return { queries: arr };
    } catch {
      console.error('Error parsing LLM response, defaulting to single query');
      return {
        queries: [
          {
            reformulatedQuery: query,
            requiresApi: false,
          },
        ],
      };
    }
  }
}
