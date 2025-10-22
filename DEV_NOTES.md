Developer Notes

This document highlights where to change prompts, LLM settings, API configs, and how to run quick tests during development.

1. Prompts

- Location: `src/prompt/`
  - `prompt-builders.ts` — centralized builders for greeting and API prompts.
  - `rag-prompt.ts` — main RAG prompt template used by the graph.
  - `query-decomposer-prompt.ts` — decomposer prompt used by `QueryDecomposerService`.

Tips:

- Keep a copy of any experimental prompt variations in the same folder with a suffix like `.v1`, `.v2`.
- Use console logs in `QueryDecomposerService` to inspect raw LLM output.

2. LLM

- Location: `src/resources/rag/llm.factory.ts`
- Change model, temperature, or provider config here.
- For reproducible outputs set `temperature: 0` during prompt tuning.

3. API configs

- Location: `src/common/utils/api.service.ts`
- Add new APIs to the `apiConfigs` map. Use `responseMapping` to normalize external JSON into the internal shape.

4. Vector store & embeddings

- Locations: `src/resources/rag/embeddings.factory.ts` and `src/resources/rag/vector-store.factory.ts`
- To switch embedding models or vector stores, update the factories and ensure `vectorStore.similaritySearch` is compatible.

5. Running locally

- Install deps: `pnpm install`
- Start dev server: `pnpm run start:dev`
- Use Postman or curl to call endpoints under `http://localhost:3000/chat`.

6. Quick sanity checks

- Decomposer parsing: send a multi-location weather query and check console for `LLM raw output:`.
- API formatting: send a planting/farming question and check that the API response is converted to a recommendation.

7. Testing guidance

- Mock `ApiService` for unit tests to avoid network calls.
- Test the `QueryDecomposerService` by mocking the LLM response to return both valid JSON and invalid/fenced JSON to ensure parsing falls back correctly.

8. Troubleshooting

- If LLM returns non-JSON for decomposer: strengthen prompt and add examples.
- For rate limits: implement caching in `ApiService` for frequent requests (e.g., weather per city for N minutes).

9. Notes on safety & production

- Use secrets managers for API keys in prod.
- Add authentication for endpoints in production.
- Implement retry/backoff for external calls.
