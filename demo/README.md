# LlamaIndex Workflows TS Demos

This directory contains various demo applications showcasing different aspects of the LlamaIndex Workflows TS engine across different runtimes and frameworks.

## Overview

Each demo is **standalone** and can be run independently with `npm install` and the appropriate start command. The demos demonstrate:

- **Basic workflow patterns** - Event handling, parallel processing, state management
- **AI integration** - OpenAI tool calling, human-in-the-loop workflows
- **Framework integration** - Express, Hono, Next.js, Waku, Cloudflare Workers
- **Runtime support** - Node.js, Deno, Browser environments
- **Advanced features** - HTTP workflows, visualization, tracing, MCP integration

## Demos

### 🌐 **Browser** - Frontend-only workflow execution
- **Location**: `./browser/`
- **Tech**: React + Vite + TypeScript
- **Features**: Client-side workflow execution, React integration
- **Run**: `npm install && npm run dev`

### ☁️ **Cloudflare Workers** - Edge runtime workflows
- **Location**: `./cloudflare/`
- **Tech**: Cloudflare Workers + Hono + Wrangler
- **Features**: Edge computing, serverless workflows
- **Run**: `npm install && npm run dev`

### 🦕 **Deno** - Deno runtime integration
- **Location**: `./deno/`
- **Tech**: Deno + JSR + npm compatibility
- **Features**: Native Deno support, JSR imports, testing
- **Run**: `deno task dev`

### 🚀 **Express** - Client-server architecture
- **Location**: `./express/`
- **Tech**: Express.js + TypeScript + OpenAI
- **Features**: REST API, human-in-the-loop, state snapshots
- **Run**: `npm install && npm run server`

### ⚡ **Hono** - Lightweight web framework
- **Location**: `./hono/`
- **Tech**: Hono + Node.js + OpenAI
- **Features**: Fast web framework, AI agents, HITL workflows
- **Run**: `npm install && npm run dev`

### 📦 **Node.js** - Comprehensive Node.js examples
- **Location**: `./node/`
- **Tech**: Node.js + TypeScript + various libraries
- **Features**: Multiple patterns, RxJS, MCP, file parsing
- **Run**: `npm install && npm run basic`

### ⚛️ **Next.js** - Full-stack React application
- **Location**: `./next/`
- **Tech**: Next.js + React + Tailwind CSS
- **Features**: PDF processing, AI workflows, modern UI
- **Run**: `npm install && npm run dev`

### 🔍 **Trace Events** - OpenTelemetry integration
- **Location**: `./trace-events/`
- **Tech**: Node.js + OpenTelemetry + TypeScript
- **Features**: Workflow tracing, observability, debugging
- **Run**: `npm install && npm run dev`

### 📊 **Visualization** - Workflow visualization
- **Location**: `./visualization/`
- **Tech**: React + Vite + D3.js
- **Features**: Workflow graph visualization, interactive UI
- **Run**: `npm install && npm run dev`

### 🌊 **Waku** - React Server Components
- **Location**: `./waku/`
- **Tech**: Waku + React + Neon DB + OpenAI
- **Features**: RAG application, vector search, document parsing
- **Run**: `npm install && npm run dev`

## Quick Start

1. **Choose a demo** that matches your use case
2. **Navigate to the demo directory**: `cd demo/[demo-name]`
3. **Install dependencies**: `npm install` (or `deno task` for Deno)
4. **Set environment variables** (if required):
   ```bash
   export OPENAI_API_KEY=your-key
   export DATABASE_URL=your-db-url
   ```
5. **Run the demo**: `npm run dev` (or `deno task dev` for Deno)

## Common Patterns

### Basic Workflow
```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";

const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();
const workflow = createWorkflow();

workflow.handle([startEvent], (context, { data }) => {
  return stopEvent.with(`Hello, ${data}!`);
});
```

### HTTP Integration
```typescript
import { createServer } from "@llamaindex/workflow-http/server";

export const POST = createServer(
  workflow,
  async (data, sendEvent) => {
    sendEvent(startEvent.with(data.input));
  },
  (stream) => stream.until(stopEvent)
);
```

### State Management
```typescript
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";

const { withState } = createStatefulMiddleware(() => ({
  count: 0,
}));

const workflow = withState(createWorkflow());
```

## Development

Each demo is configured to work both:
- **In the monorepo** - Uses workspace dependencies for development
- **Standalone** - Uses published packages for independent execution

The demos use consistent naming (`demo-*`) and include all necessary dependencies for standalone execution.

## Contributing

When adding new demos:
1. Create a new directory with a descriptive name
2. Include a `package.json` with all dependencies
3. Add a `tsconfig.json` if using TypeScript
4. Create a comprehensive `README.md`
5. Ensure the demo works standalone with `npm install`
6. Update this main README with the new demo
