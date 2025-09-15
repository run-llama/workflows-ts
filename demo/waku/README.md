# Waku Workflow Demo

This demo shows how to use the LlamaIndex Workflows TS engine with Waku (React Server Components framework) to build a RAG (Retrieval-Augmented Generation) application with document parsing and vector search.

## Overview

The demo creates a Waku application that:
- Parses documents using LlamaIndex parsing service
- Stores document embeddings in a Neon database
- Provides vector search functionality
- Uses React Server Components for the frontend
- Demonstrates HTTP workflow integration

## Architecture

The demo consists of:

- **`src/pages/index.tsx`** - Main page with RAG component
- **`src/components/RAG.tsx`** - RAG interface component
- **`src/pages/api/store.ts`** - API endpoint for workflow execution
- **`src/workflow/basic.ts`** - Core workflow with database operations
- **`src/workflow/events.ts`** - Workflow event definitions
- **`src/workflow/llama-parse.ts`** - Document parsing workflow
- **`src/schema/index.ts`** - Zod schemas for validation

## How it works

1. **Document Upload** - User uploads a file through the web interface
2. **Document Parsing** - File is processed using LlamaIndex parsing service
3. **Embedding Generation** - OpenAI creates embeddings for the parsed text
4. **Database Storage** - Embeddings are stored in Neon database
5. **Vector Search** - Users can search for similar content using vector similarity
6. **Results Display** - Search results are displayed in the UI

## Workflow Definitions

### Basic RAG Workflow
```typescript
const workflow = createWorkflow();

workflow.handle([storeEvent], async (context, { data }) => {
  // Generate embeddings and store in database
  const embedding = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: data,
  });
  await sql`INSERT INTO text_vectors (text, embedding) VALUES (${data}, ${JSON.stringify(embedding)})`;
  return stopEvent.with("success");
});

workflow.handle([searchEvent], async (context, { data }) => {
  // Search for similar content using vector similarity
  const result = await sql`SELECT text FROM text_vectors ORDER BY embedding <=> ${JSON.stringify(embedding)} LIMIT 5`;
  return stopEvent.with(result.map((row) => row.text).join("\n"));
});
```

### HTTP Integration
```typescript
export const POST = createServer(
  workflow,
  async (data, sendEvent) => {
    if (data.file) {
      const text = await job.markdown();
      sendEvent(storeEvent.with(text));
    } else if (data.search) {
      sendEvent(searchEvent.with(data.search));
    }
  },
  (stream) => stream.until(stopEvent),
);
```

## Usage

### Prerequisites

- Node.js 18+
- npm (or pnpm)
- OpenAI API key
- Neon database (or compatible PostgreSQL)
- LlamaIndex API key

### Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set environment variables:

   ```bash
   export OPENAI_API_KEY=your-openai-key
   export DATABASE_URL=your-neon-database-url
   export LLAMA_CLOUD_API=your-llamaindex-key
   ```

3. Set up the database:

   ```sql
   CREATE TABLE text_vectors (
     id SERIAL PRIMARY KEY,
     text TEXT NOT NULL,
     embedding VECTOR(1536)
   );
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

   This will start the Waku server at `http://localhost:3000`

5. Open your browser and navigate to the local URL

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm run start
```

## API Endpoints

- **`POST /api/store`** - Process documents and search functionality
  - Upload files for parsing and storage
  - Search for similar content using vector similarity

## Configuration

The application uses:
- **Waku** - React Server Components framework
- **Neon Database** - PostgreSQL with vector extensions
- **OpenAI** - Embeddings and AI processing
- **LlamaIndex** - Document parsing service
- **Tailwind CSS** - Styling
- **Zod** - Schema validation

## Dependencies

- **`@llamaindex/workflow-core`** - Core workflow engine
- **`@llamaindex/workflow-http`** - HTTP workflow integration
- **`waku`** - React Server Components framework
- **`@neondatabase/serverless`** - Database client
- **`openai`** - OpenAI API client
- **`react`** - React library
- **`lucide-react`** - Icons
- **`zod`** - Schema validation

## Key Features Demonstrated

- **RAG Implementation** - Document parsing and vector search
- **React Server Components** - Server-side rendering with Waku
- **HTTP Workflow Integration** - Seamless API integration
- **Vector Database** - PostgreSQL with vector similarity search
- **Document Processing** - LlamaIndex parsing service integration
- **Real-time UI** - Reactive frontend with workflow events
- **Type Safety** - Full TypeScript support with Zod validation
