# NestJS RAG API

A comprehensive NestJS RAG (Retrieval-Augmented Generation) API with LangChain, Pinecone, and Groq integration.

## Features

- 🤖 **RAG Implementation**: Complete RAG pipeline with document ingestion and question-answering
- 🔍 **Vector Search**: Pinecone integration for efficient similarity search
- 🧠 **LLM Integration**: Groq LLM for generating contextual answers
- 📄 **Document Processing**: Web scraping and text ingestion capabilities
- 🚀 **Modern NestJS Architecture**: Clean, modular design with dependency injection
- 📝 **API Documentation**: Swagger/OpenAPI integration for interactive API docs
- ✅ **Validation**: Input validation using class-validator and class-transformer
- 🔧 **Configuration**: Environment-based configuration management

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Pinecone account and API key
- Groq API key
- Supabase account (optional, for additional vector storage)

### Installation

```bash
cd backend
npm install
```

### Environment Setup

Create a `.env` file in the backend directory with your API keys:

```env
PINECONE_API_KEY=your_pinecone_api_key
GROQ_API_KEY=your_groq_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
PORT=3001
NODE_ENV=development
```

### Running the Application

```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

### API Documentation

Once the application is running, you can access:

- API Documentation: http://localhost:3001/api/docs
- Health Check: http://localhost:3001/health

## API Endpoints

### Documents
- `POST /documents/ingest/url` - Ingest documents from a URL
- `POST /documents/ingest/text` - Ingest text documents directly
- `GET /documents/search` - Search similar documents

### Chat
- `POST /chat/ask` - Ask a question using RAG

### Health
- `GET /health` - Health check endpoint

## Usage Examples

### 1. Ingest Documents from URL

```bash
curl -X POST http://localhost:3001/documents/ingest/url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://lilianweng.github.io/posts/2023-06-23-agent/",
    "selector": "p"
  }'
```

### 2. Ingest Text Documents

```bash
curl -X POST http://localhost:3001/documents/ingest/text \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "This is the first document about AI agents.",
      "This is the second document about machine learning."
    ]
  }'
```

### 3. Ask a Question

```bash
curl -X POST http://localhost:3001/chat/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is Subgoal and decomposition?"
  }'
```

### 4. Search Similar Documents

```bash
curl "http://localhost:3001/documents/search?query=AI%20agents&k=3"
```

## Project Structure

```
src/
├── app.module.ts          # Root module
├── main.ts               # Application entry point
├── rag/                  # RAG core functionality
│   ├── rag.service.ts    # Main RAG service with LangChain integration
│   └── rag.module.ts     # RAG module
├── documents/            # Document management
│   ├── documents.controller.ts
│   ├── documents.service.ts
│   ├── documents.module.ts
│   └── dto/              # Data transfer objects
├── chat/                 # Chat/Q&A functionality
│   ├── chat.controller.ts
│   ├── chat.service.ts
│   ├── chat.module.ts
│   └── dto/              # Data transfer objects
```

## Technologies Used

- **NestJS**: Modern Node.js framework
- **LangChain**: LLM application framework
- **Pinecone**: Vector database for embeddings
- **Groq**: Fast LLM inference
- **Cheerio**: Web scraping
- **TypeScript**: Type-safe development
- **Swagger**: API documentation

## Testing

```bash
# Unit tests
npm run test

# Test coverage
npm run test:cov
```