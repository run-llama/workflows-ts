# Node.js Workflow Demos

This directory contains various Node.js examples demonstrating different aspects of the LlamaIndex Workflows TS engine.

## Overview

The demos showcase:
- Basic workflow patterns with parallel processing
- AI agent workflows with tool calling
- File parsing workflows with state management
- Human-in-the-loop interactions
- RxJS integration for reactive programming
- MCP (Model Context Protocol) server integration

## Files

- **`basic.ts`** - Basic workflow with parallel branch processing
- **`tool-call-agent.ts`** - AI agent with tool calling capabilities
- **`llama-parse-workflow.ts`** - File parsing using LlamaIndex
- **`name-ask-readline.ts`** - Human-in-the-loop with readline interface
- **`file-parse-promise.ts`** - File parsing with promise-based approach
- **`file-parse-rxjs.ts`** - File parsing with RxJS reactive streams
- **`mcp-file-parse-tool.ts`** - MCP server with file parsing workflow

## How it works

### Basic Workflow (`basic.ts`)
1. **Parallel Processing** - Emits multiple events simultaneously
2. **Branch Handling** - Each branch processes independently
3. **Result Aggregation** - Collects results from all branches
4. **Stream Processing** - Uses Node.js streams for event handling

### AI Agent Workflow (`tool-call-agent.ts`)
1. **Tool Calling** - AI can call external tools (weather API)
2. **Workflow Execution** - Uses `runWorkflow` helper for simple execution
3. **Response Handling** - Returns AI-generated responses

### File Parsing (`file-parse-*.ts`)
1. **Directory Scanning** - Recursively processes files
2. **State Management** - Tracks parsing progress and results
3. **Multiple Approaches** - Promise-based and RxJS implementations

### Human-in-the-Loop (`name-ask-readline.ts`)
1. **Interactive Input** - Uses readline for user interaction
2. **Event Handling** - Listens for human request events
3. **Workflow Resumption** - Continues after human input

## Usage

### Prerequisites

- Node.js 18+
- npm (or pnpm)
- OpenAI API key (for AI workflows)
- LlamaIndex API key (for file parsing)

### Basic Examples

```bash
# Basic parallel workflow
npx tsx basic.ts

# AI agent with tool calling
export OPENAI_API_KEY=your-key
npx tsx tool-call-agent.ts

# File parsing workflow
export LLAMA_CLOUD_API=your-key
npx tsx llama-parse-workflow.ts path/to/file.pdf

# Human-in-the-loop interaction
npx tsx name-ask-readline.ts
```

### Advanced Examples

```bash
# File parsing with promises
npx tsx file-parse-promise.ts

# File parsing with RxJS
npx tsx file-parse-rxjs.ts

# MCP server
npx tsx mcp-file-parse-tool.ts
```

## Workflow Patterns

### Basic Parallel Processing
```typescript
const workflow = createWorkflow();
workflow.handle([startEvent], async () => {
  const { sendEvent, stream } = getContext();
  sendEvent(branchAEvent.with("Branch A"));
  sendEvent(branchBEvent.with("Branch B"));
  sendEvent(branchCEvent.with("Branch C"));
  
  const results = await stream.filter(branchCompleteEvent).take(3).toArray();
  return allCompleteEvent.with(results.map((e) => e.data).join(", "));
});
```

### AI Agent with Tools
```typescript
import { runWorkflow } from "@llamaindex/workflow-core/stream/run";

runWorkflow(
  toolCallWorkflow,
  startEvent.with("what is weather today"),
  stopEvent,
).then(({ data }) => {
  console.log("AI response", data);
});
```

### Human-in-the-Loop
```typescript
stream.on(humanRequestEvent, async (event) => {
  const name = await input({
    message: JSON.parse(event.data).message,
  });
  sendEvent(humanInteractionEvent.with(name));
});
```

## Dependencies

- **`@llamaindex/workflow-core`** - Core workflow engine
- **`rxjs`** - Reactive programming (file-parse-rxjs.ts)
- **`@inquirer/prompts`** - Interactive prompts (name-ask-readline.ts)
- **`@modelcontextprotocol/sdk`** - MCP server (mcp-file-parse-tool.ts)
- **`zod`** - Schema validation (mcp-file-parse-tool.ts)

## Key Features Demonstrated

- **Parallel Processing** - Multiple workflow branches
- **AI Integration** - OpenAI tool calling
- **State Management** - Workflow state tracking
- **Human Interaction** - Interactive workflows
- **Reactive Programming** - RxJS integration
- **Stream Processing** - Node.js stream handling
- **MCP Integration** - Model Context Protocol server
- **File Processing** - Document parsing workflows
