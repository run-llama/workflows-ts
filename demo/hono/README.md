# Hono Workflow Demo

This demo shows how to use the LlamaIndex Workflows TS engine with Hono web framework, demonstrating AI agent workflows with tool calling and human-in-the-loop interactions.

## Overview

The demo creates a Hono server that:
- Handles AI agent workflows with tool calling
- Implements human-in-the-loop (HITL) workflows with state snapshots
- Uses OpenAI for AI completions and tool execution
- Demonstrates workflow state management and resumption

## Architecture

The demo consists of:

- **`app.ts`** - Main Hono server with workflow endpoints
- **`package.json`** - Dependencies and scripts
- **`../workflows/tool-call-agent.ts`** - AI agent workflow with tool calling
- **`../workflows/human-in-the-loop.ts`** - HITL workflow with state management

## How it works

1. **Tool Call Workflow** - AI agent processes user input and can call tools (like weather API)
2. **Human-in-the-Loop Workflow** - AI can request human input and resume from snapshots
3. **State Management** - Workflows can be paused, snapshotted, and resumed
4. **Response** - Server returns workflow results as JSON

## Workflow Definitions

### Tool Call Agent
```typescript
const startEvent = workflowEvent<string>();
const toolCallEvent = workflowEvent<ChatCompletionMessageToolCall>();
const stopEvent = workflowEvent<string>();

workflow.handle([startEvent], async (context, { data }) => {
  // Process with OpenAI and handle tool calls
});
```

### Human-in-the-Loop
```typescript
const { withState } = createStatefulMiddleware();
const workflow = withState(createWorkflow());

workflow.handle([startEvent], async (context, { data }) => {
  // AI can request human input via humanRequestEvent
});
```

## Usage

### Prerequisites

- Node.js 18+ 
- npm (or pnpm)
- OpenAI API key

### Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set your OpenAI API key:

   ```bash
   export OPENAI_API_KEY=your-api-key-here
   ```

3. Start the development server:

   ```bash
   npx tsx app.ts
   ```

   This will start the server at `http://localhost:3000`

4. Test the endpoints with curl or a REST client

### API Endpoints

- **`POST /workflow`** - Execute tool call agent workflow
- **`POST /human-in-the-loop`** - Execute HITL workflow with state snapshots

### Example Usage

```bash
# Tool call workflow
curl -X POST http://localhost:3000/workflow \
  -H "Content-Type: text/plain" \
  -d "What's the weather like in Tokyo?"

# Human-in-the-loop workflow
curl -X POST http://localhost:3000/human-in-the-loop \
  -H "Content-Type: application/json" \
  -d '{"data": "Hello"}'
```

## Configuration

The server uses:
- **Hono** - Lightweight web framework
- **@hono/node-server** - Node.js server adapter
- **OpenAI** - AI completions and tool calling
- **tsx** - TypeScript execution

## Dependencies

- **`@llamaindex/workflow-core`** - Core workflow engine
- **`hono`** - Web framework
- **`@hono/node-server`** - Node.js server
- **`openai`** - OpenAI API client
- **`tsx`** - TypeScript runner

## Key Features Demonstrated

- **AI Agent Workflows** - Tool calling with OpenAI
- **Human-in-the-Loop** - Interactive workflows with human input
- **State Management** - Workflow snapshots and resumption
- **Hono Integration** - Clean web framework integration
- **TypeScript Support** - Full type safety throughout
