Agroadvisor RAG Backend — Comprehensive Documentation

Last updated: 2025-10-20

This document is a comprehensive reference for the Agroadvisor RAG backend. It expands on the README and DEV_NOTES with architecture diagrams (textual), data models, request/response contracts, operational guidance, prompt engineering guidance, test instructions, debugging steps, and extension points for engineers working on this repository.

Table of contents

- Project purpose & goals
- High-level architecture (text diagram)
- Core components and responsibilities
- Data model & persistence
- API surface (detailed) with examples
- RAG pipeline: step-by-step flow
- Query decomposition: contract & prompt guidance
- Prompts: where they live and how to iterate
- LLM & provider configuration
- Vector store & embeddings
- External API integration (ApiService)
- Conversation lifecycle & metadata
- Error handling and logging
- Testing strategy and examples
- Local development & debugging checklist
- Deployment and production considerations
- Security and operational best practices
- Extending the system (recipes)
- Appendix: useful commands and tips

Project purpose & goals

Agroadvisor RAG Backend — Code-focused Documentation

Last updated: 2025-10-20

This document maps the repository code to developer-facing documentation. It points at exact files, function signatures, and shows quick code snippets for the most common edits (prompts, LLM, API config). Use this when you want to change behavior in code rather than the high-level system.

Table of contents

- Quick repo map (files you will edit most)
- Key functions and signatures
- Where to change prompts (exact files and code snippets)
- How to change the LLM (exact file and snippet)
- How to add or modify external APIs
- How to run and test locally (scripts & tests)
- Debugging tips (file-level)
- Common edits: examples
- Next steps & recommended improvements

Quick repo map (files you'll edit frequently)

- `src/resources/rag/rag.service.ts` — main orchestration. Key methods: `askQuestion`, `handleGreeting`, `handleDecomposed`.
- `src/resources/rag/query-decomposer.service.ts` — LLM-driven query decomposition.
- `src/common/utils/api.service.ts` — API configuration and `callApi` implementation.
- `src/prompt/query-decomposer-prompt.ts` — decomposer prompt used by QueryDecomposerService.
- `src/prompt/rag-prompt.ts` — main RAG prompt used by LangGraph generator in `rag.service.ts`.
- `src/prompt/prompt-builders.ts` — helper prompt builders (greeting, api formatting).
- `src/resources/rag/llm.factory.ts` — where the LLM instance is created.
- `src/resources/rag/embeddings.factory.ts`, `vector-store.factory.ts` — embeddings and Pinecone wiring.
- `src/resources/chat/chat.controller.ts` — HTTP endpoints you call from the client.
- `scripts/smoke-test.js` — a quick smoke test script you can run locally.
- `src/__tests__/` — unit tests: `query-decomposer.spec.ts`, `api.service.spec.ts`.

Key functions and signatures (copy/paste friendly)

- Query decomposition

  File: `src/resources/rag/query-decomposer.service.ts`

  Signature:

  ```ts
  async decomposeAndReformulate(query: string): Promise<{
    queries: Array<{
      reformulatedQuery: string;
      requiresApi: boolean;
      apiName?: string;
      apiParams?: any;
    }>;
  }>
  ```

  Notes: This method invokes the LLM, strips fencing, extracts the first JSON block and returns a `queries` array. If parsing fails, it returns a single query fallback.

- RAG orchestration

  File: `src/resources/rag/rag.service.ts`

  Signature (entrypoint):

  ```ts
  async askQuestion(question: string, conversationId?: string, userId?: string)
  ```

  Important private handlers:
  - `handleGreeting(question, conversationId, conversation, startTime)` — straight LLM conversational reply.
  - `handleDecomposed(question, conversationId, conversation, chatHistory, startTime)` — runs decomposition, calls APIs or RAG graph per sub-query.

- ApiService

  File: `src/common/utils/api.service.ts`

  Important method:

  ```ts
  async callApi(apiName: string, params: Record<string, any> = {}): Promise<any>
  ```

  Add API configs inside `initializeApiConfigs()` via `this.apiConfigs.set('name', { endpoint, method, headers, responseMapping })`.

Where to change prompts (exact files and snippets)

- Decomposer prompt (most sensitive): `src/prompt/query-decomposer-prompt.ts`.
  - Edit examples and JSON schema here.
  - Example: to force JSON only, ensure the prompt begins with `Respond ONLY with a valid JSON array. Do not include any explanation, markdown, or extra text.`

- RAG prompt: `src/prompt/rag-prompt.ts`.
  - This file contains `customRagPrompt` (LangChain ChatPromptTemplate) used by the graph generator to produce final answers from retrieved docs + API context.

- API and greeting builders: `src/prompt/prompt-builders.ts`.
  - Use `buildApiPrompt({ userQuestion, apiData, isFarmingQuery })` to create the system+user messages you pass to the LLM when formatting API output.

Example edit (change tone of API answers):

File: `src/prompt/prompt-builders.ts`

Replace system prompt content for agriculture in `SYSTEM_PROMPTS.agriculture`.

How to change the LLM (exact file and snippet)

File: `src/resources/rag/llm.factory.ts`

Example:

```ts
import { ChatGroq } from '@langchain/groq';

export class LlmFactory {
  static createDefaultLlm() {
    return new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
    });
  }
}
```

Change `model` or `temperature` here. For deterministic decomposition use `temperature: 0` during prompt tuning or tests.

How to add or modify external APIs

File: `src/common/utils/api.service.ts`

Inside `initializeApiConfigs()` you'll find the `weather` and `news` examples. Add new entries like:

```ts
this.apiConfigs.set('myapi', {
  name: 'myapi',
  endpoint: 'https://api.example.com/v1/data',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.MYAPI_KEY}`,
  },
  responseMapping: (data) => ({
    /* normalized object for prompts */
  }),
});
```

Notes:

- The `responseMapping` function MUST return plain JS objects (no complex classes) because they are stringified into prompts.
- After adding the API, add examples in `query-decomposer-prompt.ts` so the decomposer can output `apiName: 'myapi'` when relevant.

How to run and test locally (scripts & tests)

- Install dependencies:

```bash
pnpm install
```

- Run dev server:

```bash
pnpm run start:dev
```

- Smoke test (server must be running):

```bash
pnpm run smoke
```

- Unit tests:

```bash
pnpm test
```

Files added to help testing:

- `scripts/smoke-test.js` — quick REST smoke script.
- `src/__tests__/query-decomposer.spec.ts` — tests the decomposer parsing (mock LLM)
- `src/__tests__/api.service.spec.ts` — tests `ApiService` `responseMapping` for weather.

Debugging tips (file-level)

- If decomposition fails, inspect `src/resources/rag/query-decomposer.service.ts`. It logs the raw LLM output with `console.log('LLM raw output:', content);` before parsing.
- If API answers are raw JSON, edit `src/prompt/prompt-builders.ts` system prompts to instruct the LLM to return a more conversational result.
- For RAG answers, inspect `src/resources/rag/rag.service.ts` `generate` node in `initializeGraph()` — it uses `customRagPrompt` and then `this.llm.invoke(messages)`.

Common edits: examples

1. Make decomposer deterministic for tests:

```diff
// src/resources/rag/llm.factory.ts
return new ChatGroq({ model: 'llama-3.3-70b-versatile',-      temperature: 0.1,+      temperature: process.env.LLM_TEMPERATURE ? Number(process.env.LLM_TEMPERATURE) : 0.0, });
```

2. Change weather API mapping to include `feels_like`:

```diff
// src/common/utils/api.service.ts
responseMapping: (data) => ({
  temperature: data.main.temp,
  feels_like: data.main.feels_like,
  temperature_celsius: Math.round(data.main.temp - 273.15),
  ...
})
```

Next steps & recommended improvements

- Add strict TypeScript interfaces for the decomposer output to eliminate `any` usage across the codebase.
- Add caching for weather responses (simple in-memory TTL or Redis) in `ApiService`.
- Add integration tests that run the full flow against a mocked LLM provider to validate end-to-end behavior in CI.

If you'd like, I can implement one of these improvements now (for example: add a small in-memory cache in `ApiService`, or make the `llm.factory.ts` temperature configurable via env). Which would you like me to do first?

========================================
API Reference (endpoints, request/response, examples)
========================================

This section contains per-endpoint request/response schemas, example cURL requests, and where each endpoint is implemented in code.

Base path: /chat

1. POST /chat/conversations

- Purpose: Create a new conversation (optional title and userId)
- Controller: `src/resources/chat/chat.controller.ts` → `createConversation`

Request body (JSON):

```json
{
  "title": "Optional conversation title",
  "userId": "optional-user-id"
}
```

Response (201):

```json
{
  "conversationId": "<uuid>",
  "message": "Conversation created successfully"
}
```

Example cURL:

```bash
curl -X POST http://localhost:3000/chat/conversations \
  -H "Content-Type: application/json" \
  -d '{"title":"About Esoko","userId":"123"}'
```

2. GET /chat/conversations?userId=&limit=

- Purpose: List recent conversations
- Controller: `src/resources/chat/chat.controller.ts` → `getRecentConversations`

Query params:

- userId (optional) — filter by user
- limit (optional) — number of items to return (default 10)

Response (200):

```json
[
  { "id": "<uuid>", "title": "About Esoko", "createdAt": "..." },
  ...
]
```

Example cURL:

```bash
curl "http://localhost:3000/chat/conversations?userId=123&limit=5"
```

3. GET /chat/conversations/:conversationId/stats

- Purpose: Conversation statistics
- Controller: `src/resources/chat/chat.controller.ts` → `getConversationStats`

Response (200):

```json
{ "conversationId": "<uuid>", "messagesCount": 12, "lastUpdated": "..." }
```

4. DELETE /chat/conversations/:conversationId

- Purpose: Delete a conversation
- Controller: `src/resources/chat/chat.controller.ts` → `deleteConversation`

Response: 204 No Content

Example cURL:

```bash
curl -X DELETE http://localhost:3000/chat/conversations/<conversationId>
```

5. DELETE /chat/conversations/:conversationId/messages

- Purpose: Clear conversation messages but keep conversation
- Controller: `src/resources/chat/chat.controller.ts` → `clearConversationHistory`

Response: 204 No Content

6. POST /chat/ask

- Purpose: Ask a question (creates conversation if not provided)
- Controller: `src/resources/chat/chat.controller.ts` → `askQuestion`

Request body:

```json
{
  "question": "Will it rain in Kumasi today?",
  "userId": "123" // optional
}
```

Response (201):

```json
{
  "question": "Will it rain in Kumasi today?",
  "answer": "It's currently overcast in Kumasi but the forecast doesn't show rain today...",
  "conversationId": "<uuid>",
  "timestamp": "2025-10-20T...",
  "processingTime": 123,
  "messageType": "RAG",
  "history": []
}
```

Example cURL:

```bash
curl -X POST http://localhost:3000/chat/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"Will it rain in Kumasi today?","userId":"123"}'
```

7. POST /chat/follow-up/:conversationId

- Purpose: Ask a follow-up question in an existing conversation
- Controller: `src/resources/chat/chat.controller.ts` → `askFollowUp`

Request body same as `/chat/ask`.

8. GET /chat/history/:conversationId?limit=&offset=

- Purpose: Get conversation messages (supports pagination)
- Controller: `src/resources/chat/chat.controller.ts` → `getHistory`

Response (200):

```json
{
  "conversationId": "<uuid>",
  "messages": [
    { "_getType": "human", "content": "...", "id": "...", "metadata": {} },
    { "_getType": "ai", "content": "...", "id": "...", "metadata": {} }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

## Environment variables (names, purpose, example)

This project reads configuration from environment variables. Below are the keys present in `.env.example` and their purpose.

| Name                 | Required                            | Purpose                                    | Example                                 |
| -------------------- | ----------------------------------- | ------------------------------------------ | --------------------------------------- |
| PORT                 | Optional                            | Port the server will listen on             | 3000                                    |
| WEATHER_API_KEY      | Optional/Required for weather API   | RapidAPI/OpenWeather key for weather calls | <your-key>                              |
| PINECONE_API_KEY     | Optional if using Pinecone          | Pinecone API key                           | <your-key>                              |
| PINECONE_ENVIRONMENT | Optional                            | Pinecone environment/region                | us-west1                                |
| PINECONE_INDEX       | Optional                            | Pinecone index name                        | agroadvisor-index                       |
| GROQ_API_KEY         | Optional/Required if using GROQ LLM | API key for ChatGroq provider              | <your-key>                              |
| DATABASE_URL         | Optional/Required for DB            | Postgres connection string                 | postgresql://user:pass@host:5432/dbname |

Notes:

- Keep API keys out of version control. Use a secrets manager in production.
- If you don't use Pinecone, the RAG retrieval will be disabled or will fall back to local/ad-hoc behavior depending on your runtime wiring.

## JSDoc and inline code comments added

I added JSDoc comments to the following files to make the code easier to browse in editors and to clarify public method contracts:

- `src/common/utils/api.service.ts` — class doc and `callApi` method
- `src/resources/rag/query-decomposer.service.ts` — class doc and `decomposeAndReformulate`
- `src/resources/rag/rag.service.ts` — class doc and high-level public methods (`askQuestion`, `handleGreeting`, `handleDecomposed`, `createConversation`)

If you'd like, I can expand JSDoc throughout the repository (conversations service, documents service, controllers) or generate a typed documentation site from the comments.

## Mermaid diagrams (visual flowcharts)

Below are three mermaid diagrams to help visualize the architecture, the RAG pipeline, and the request sequence for `POST /chat/ask`.

1. High-level architecture

```mermaid
flowchart LR
  Client[Client (UI / Mobile / CLI)] -->|HTTP| ChatController[/src/resources/chat/chat.controller.ts/]
  ChatController --> ChatService[/src/resources/chat/chat.service.ts/]
  ChatService --> RagService[/src/resources/rag/rag.service.ts/]
  RagService -->|use| QueryDecomposer[QueryDecomposerService\n/src/resources/rag/query-decomposer.service.ts]
  RagService -->|call| ApiService[/src/common/utils/api.service.ts/]
  RagService -->|retrieve| VectorStore[/src/resources/rag/vector-store.factory.ts (Pinecone)]
  RagService -->|invoke| LLM[/src/resources/rag/llm.factory.ts (ChatGroq / LangChain)]
  RagService --> Database[(Database: Conversations, Messages)]
  ApiService --> ExternalAPIs[(External APIs: Weather, News, etc.)]
  VectorStore --> Pinecone[(Pinecone index)]
```

Notes: file paths in square brackets map boxes to the implementation files in the repo.

2. RAG pipeline internal flow

```mermaid
flowchart TD
  A[Receive question] --> B{Is greeting?}
  B -- Yes --> C[buildGreetingPrompt()
  (/src/prompt/prompt-builders.ts)] --> D[LLM.invoke() -> answer]
  D --> E[save message pair (conversations.service)]
  B -- No --> F[QueryDecomposer.decomposeAndReformulate()
  (/src/resources/rag/query-decomposer.service.ts)]
  F --> G{For each sub-query}
  G -->|requiresApi| H[ApiService.callApi(apiName, params)]
  H --> I[format API context via buildApiPrompt()
  (/src/prompt/prompt-builders.ts)]
  I --> J[LLM.invoke() -> apiAnswer]
  G -->|requiresRAG| K[vectorStore.similaritySearch()]
  K --> L[customRagPrompt + LLM.invoke() -> ragAnswer]
  J --> M[Aggregate answers]
  L --> M
  M --> N[save message pair & metadata]
  N --> O[Return composed response to client]
```

3. Sequence diagram: POST /chat/ask

```mermaid
sequenceDiagram
  participant Client
  participant Controller as ChatController
  participant Service as ChatService
  participant Rag as RagService
  participant Decomposer as QueryDecomposer
  participant Api as ApiService
  participant LLM as LLM
  participant DB as Database

  Client->>Controller: POST /chat/ask { question }
  Controller->>Service: askQuestion(question, userId)
  Service->>Rag: askQuestion(question, conversationId?)
  Rag->>DB: getConversation(conversationId)
  Rag->>Decomposer: decomposeAndReformulate(question)
  Decomposer-->>Rag: [sub-queries]
  alt sub-query requires API
    Rag->>Api: callApi(apiName, params)
    Api-->>Rag: apiData
    Rag->>LLM: buildApiPrompt + invoke(apiData)
    LLM-->>Rag: formattedApiAnswer
  else sub-query requires RAG
    Rag->>LLM: vectorStore.similaritySearch + customRagPrompt
    LLM-->>Rag: ragAnswer
  end
  Rag->>DB: addMessagePair(userQuestion, composedAnswer)
  Rag-->>Service: composed response
  Service-->>Controller: response
  Controller-->>Client: 200/201 { answer }
```

## How to render these diagrams

- GitHub's web UI does not render mermaid by default for arbitrary markdown; use a mermaid-capable viewer (VS Code markdown preview with Mermaid plugin, Obsidian, or docs site generators like MkDocs with Mermaid plugin).
- If you want, I can produce PNG/SVG exports of these diagrams and add them to a `docs/diagrams/` folder for easy viewing in GitHub.
