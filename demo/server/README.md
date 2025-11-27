# Workflow Server Demo

This demo shows how to use `@llamaindex/workflow-server` to expose LlamaIndex workflows as REST APIs with OpenAPI documentation.

## Overview

The demo creates a Fastify server with three example workflows:

1. **greeting** - A simple workflow that returns a greeting message
2. **calculator** - Performs basic math operations (add, subtract, multiply, divide)
3. **echo** - Returns whatever data you send to it

## Features Demonstrated

- Workflow registration with `WorkflowServer`
- RESTful API endpoints for workflow execution
- OpenAPI/Swagger documentation
- Custom Fastify configuration
- Multiple workflows on a single server

## Quick Start

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the server:

   ```bash
   pnpm start
   ```

3. Open Swagger UI:

   ```
   http://localhost:3000/documentation
   ```

## API Endpoints

### Root

```bash
curl http://localhost:3000/
```

Returns server information and available endpoints.

### Health Check

```bash
curl http://localhost:3000/health
```

### List Workflows

```bash
curl http://localhost:3000/workflows
```

**Response:**
```json
["greeting", "calculator", "echo"]
```

### Run Greeting Workflow

```bash
curl -X POST http://localhost:3000/workflows/greeting/run \
  -H "Content-Type: application/json" \
  -d '{"data": "Alice"}'
```

**Response:**
```json
{
  "result": "Hello, Alice! Welcome to the Workflow Server."
}
```

### Run Calculator Workflow

```bash
# Addition
curl -X POST http://localhost:3000/workflows/calculator/run \
  -H "Content-Type: application/json" \
  -d '{"data": {"a": 10, "b": 5, "op": "add"}}'

# Multiplication
curl -X POST http://localhost:3000/workflows/calculator/run \
  -H "Content-Type: application/json" \
  -d '{"data": {"a": 10, "b": 5, "op": "multiply"}}'
```

**Supported operations:** `add`, `subtract`, `multiply`, `divide`

**Response:**
```json
{
  "result": { "result": 50 }
}
```

### Run Echo Workflow

```bash
curl -X POST http://localhost:3000/workflows/echo/run \
  -H "Content-Type: application/json" \
  -d '{"data": {"hello": "world", "nested": {"value": 42}}}'
```

**Response:**
```json
{
  "result": { "hello": "world", "nested": { "value": 42 } }
}
```

## Configuration

The server is configured with:

```typescript
const server = new WorkflowServer({
    title: "Workflow Server Demo",
    description: "A demo server showcasing @llamaindex/workflow-server",
    version: "1.0.0",
    enableSwaggerUI: true,
});
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |

## Development

Run with auto-reload:

```bash
pnpm dev
```

## Project Structure

```
demo/server/
├── package.json    # Dependencies and scripts
├── server.ts       # Main server with workflow definitions
├── tsconfig.json   # TypeScript configuration
└── README.md       # This file
```

## Key Concepts

### Defining Events

```typescript
const startEvent = workflowEvent<InputType>();
const stopEvent = workflowEvent<OutputType>();
```

### Creating Workflows

```typescript
const workflow = createWorkflow();
workflow.handle([startEvent], (context, event) => {
    // Process event.data
    return stopEvent.with(result);
});
```

### Registering with Server

```typescript
server.registerWorkflow("name", {
    workflow,
    startEvent,
    stopEvent,
});
```

## Dependencies

- **@llamaindex/workflow-core** - Core workflow engine
- **@llamaindex/workflow-server** - HTTP server for workflows
- **fastify** - Fast and low overhead web framework
- **tsx** - TypeScript execution

