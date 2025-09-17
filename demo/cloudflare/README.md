# Cloudflare Workers Workflow Demo

This demo shows how to use the LlamaIndex Workflows TS engine with Cloudflare Workers, demonstrating a simple workflow that processes user input and returns a response.

> **Note**: This demo is part of the `cloudflare-workers-openapi` package and showcases basic workflow integration with Cloudflare Workers.

## Overview

The demo creates a Cloudflare Worker that:
- Serves a simple HTML form interface
- Handles POST requests to execute workflows
- Uses Hono as the web framework
- Demonstrates basic workflow event handling

## Architecture

The demo consists of:

- **`src/index.ts`** - Main Cloudflare Worker entry point with Hono app
- **`wrangler.jsonc`** - Cloudflare Workers configuration
- **`package.json`** - Dependencies and scripts

## How it works

1. **User visits the page** - The worker serves an HTML form with an input field
2. **User submits form** - JavaScript sends a POST request to `/workflow` with the input data
3. **Workflow execution** - The worker processes the input through a simple workflow:
   - `startEvent` receives the user input
   - Handler processes the input and emits a `stopEvent` with a greeting
4. **Response** - The worker returns the workflow result as JSON

## Workflow Definition

```typescript
const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();
const workflow = createWorkflow();

workflow.handle([startEvent], (_context, { data }) => {
  return stopEvent.with(`hello, ${data}!`);
});
```

## Usage

### Prerequisites

- Node.js 18+ 
- npm (or pnpm)
- Cloudflare account (for deployment)

### Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

   This will start the Wrangler development server, typically at `http://localhost:8787`

3. Open your browser and navigate to the local URL

4. Enter a name in the form and click "Send event" to test the workflow

### Deployment

1. Configure your Cloudflare Worker (if not already done):

   ```bash
   npm run cf-typegen
   ```

2. Deploy to Cloudflare Workers:

   ```bash
   npm run deploy
   ```

## API Endpoints

- **`GET /`** - Serves the HTML form interface
- **`POST /workflow`** - Executes the workflow with the provided input data

## Configuration

The `wrangler.jsonc` file contains the Cloudflare Workers configuration:

- **`name`**: Worker name (currently "workspace-worker")
- **`main`**: Entry point file (`src/index.ts`)
- **`compatibility_flags`**: Enables Node.js compatibility features
- **`compatibility_date`**: Sets the compatibility date for Cloudflare Workers features

## Dependencies

- **`@llamaindex/workflow-core`** - Core workflow engine
- **`hono`** - Lightweight web framework for Cloudflare Workers
- **`@cloudflare/workers-types`** - TypeScript types for Cloudflare Workers
- **`wrangler`** - Cloudflare Workers CLI tool

## Key Features Demonstrated

- **Event-driven workflows** - Simple event handling with type safety
- **Cloudflare Workers integration** - Running workflows in the edge runtime
- **Hono framework** - Clean, minimal web framework for Workers
- **TypeScript support** - Full type safety throughout the application
- **Client-side interaction** - JavaScript form handling with fetch API
