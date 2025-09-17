# LlamaIndex Workflows TS Demos

This directory contains various demo applications showcasing different aspects of the LlamaIndex Workflows TS engine across different runtimes and frameworks. Each demo is **standalone** and can be run independently with `npm install` and the appropriate start command.

## Demos

### 🌐 **Browser** - Frontend-only workflow execution
- **Location**: [`./browser/`](./browser/)
- **Tech**: React + Vite + TypeScript
- **Features**: Client-side workflow execution, React integration
- **Run**: `npm install && npm run dev`

### ☁️ **Cloudflare Workers** - Edge runtime workflows
- **Location**: [`./cloudflare/`](./cloudflare/)
- **Tech**: Cloudflare Workers + Hono + Wrangler
- **Features**: Edge computing, serverless workflows
- **Run**: `npm install && npm run dev`

### 🦕 **Deno** - Deno runtime integration
- **Location**: [`./deno/`](./deno/)
- **Tech**: Deno + JSR + npm compatibility
- **Features**: Native Deno support, JSR imports, testing
- **Run**: `deno task dev`

### 🚀 **Express** - Client-server architecture
- **Location**: [`./express/`](./express/)
- **Tech**: Express.js + TypeScript + OpenAI
- **Features**: REST API, human-in-the-loop, state snapshots
- **Run**: `npm install && npm run server`

### ⚡ **Hono** - Lightweight web framework
- **Location**: [`./hono/`](./hono/)
- **Tech**: Hono + Node.js + OpenAI
- **Features**: Fast web framework, AI agents, HITL workflows
- **Run**: `npm install && npm run dev`

### 📦 **Node.js** - Comprehensive Node.js examples
- **Location**: [`./node/`](./node/)
- **Tech**: Node.js + TypeScript + various libraries
- **Features**: Multiple patterns, RxJS, MCP, file parsing
- **Run**: `npm install && npm run basic`

### ⚛️ **Next.js** - Full-stack React application
- **Location**: [`./next/`](./next/)
- **Tech**: Next.js + React + Tailwind CSS
- **Features**: PDF processing, AI workflows, modern UI
- **Run**: `npm install && npm run dev`

### 🔍 **Trace Events** - OpenTelemetry integration
- **Location**: [`./trace-events/`](./trace-events/)
- **Tech**: Node.js + OpenTelemetry + TypeScript
- **Features**: Workflow tracing, observability, debugging
- **Run**: `npm install && npm run dev`

### 📊 **Visualization** - Workflow visualization
- **Location**: [`./visualization/`](./visualization/)
- **Tech**: React + Vite + D3.js
- **Features**: Workflow graph visualization, interactive UI
- **Run**: `npm install && npm run dev`

