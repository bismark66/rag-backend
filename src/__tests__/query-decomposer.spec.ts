import { QueryDecomposerService } from '../resources/rag/query-decomposer.service';

// Minimal mock for ChatGroq
class MockLLM {
  async invoke(messages: any) {
    // Return a fenced JSON response to test parsing
    return {
      content:
        '```json\n[{"reformulatedQuery":"What is the weather in Kumasi?","requiresApi":true,"apiName":"weather","apiParams":{"city":"Kumasi"}}]\n```',
    };
  }
}

describe('QueryDecomposerService', () => {
  it('parses fenced json from LLM', async () => {
    const svc = new QueryDecomposerService(new MockLLM() as any);
    const res = await svc.decomposeAndReformulate(
      "What's the weather in Kumasi and Accra?",
    );
    expect(res).toHaveProperty('queries');
    expect(res.queries.length).toBeGreaterThan(0);
    expect(res.queries[0].reformulatedQuery).toContain('Kumasi');
  });
});
