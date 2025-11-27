# @llamaindex/workflow-server

A Fastify-based workflow server with OpenAPI documentation for LlamaIndex Workflows.

## Overview

This package provides a production-ready HTTP server for exposing your workflows as REST APIs. It includes:

- **RESTful API** - Standard HTTP endpoints for workflow management and execution
- **OpenAPI/Swagger** - Automatic API documentation with Swagger UI
- **Type Safety** - Full TypeScript support with proper typing
- **Configurable** - Flexible options for customization

## Installation

```bash
npm install @llamaindex/workflow-server fastify
# or
pnpm add @llamaindex/workflow-server fastify
```

## Quick Start

```typescript
import Fastify from "fastify";
import { WorkflowServer } from "@llamaindex/workflow-server";
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";

// Define events
const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

// Create workflow
const greetingWorkflow = createWorkflow();
greetingWorkflow.handle([startEvent], (_context, event) => {
    return stopEvent.with(`Hello, ${event.data}!`);
});

// Create server and register workflow
const server = new WorkflowServer();
server.registerWorkflow("greeting", {
    workflow: greetingWorkflow,
    startEvent,
    stopEvent,
});

// Start Fastify
const app = Fastify({ logger: true });
await app.register(server.plugin());
await app.listen({ port: 3000 });
```

## With OpenAPI Documentation

To add Swagger UI documentation, install the swagger plugins and register them before the workflow server:

```bash
npm install @fastify/swagger @fastify/swagger-ui
```

```typescript
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { WorkflowServer } from "@llamaindex/workflow-server";

const server = new WorkflowServer();
// ... register workflows ...

const app = Fastify({ logger: true });

// Register Swagger BEFORE the workflow server
await app.register(swagger, {
    openapi: {
        info: {
            title: "My Workflow API",
            version: "1.0.0",
        },
    },
});
await app.register(swaggerUi, {
    routePrefix: "/documentation",
});

// Then register the workflow server
await app.register(server.plugin());
await app.listen({ port: 3000 });
```

Swagger UI will be available at `http://localhost:3000/documentation`.

## API Endpoints

### Health Check

```http
GET /health
```

Returns server health status.

**Response:**
```json
{
    "status": "ok"
}
```

### List Workflows

```http
GET /workflows
```

Returns a list of all registered workflow names.

**Response:**
```json
["greeting", "data-processor", "agent"]
```

### Run Workflow (Synchronous)

```http
POST /workflows/:name/run
```

Executes a workflow synchronously and waits for completion.

**Request Body:**
```json
{
    "data": "World",
    "timeout": 30000
}
```

**Response:**
```json
{
    "result": "Hello, World!"
}
```

## Configuration

### WorkflowServerOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `""` | Base path prefix for all routes |

### Example with Prefix

```typescript
const server = new WorkflowServer({
    prefix: "/api/v1",
});
```

With this configuration, endpoints will be available at:
- `GET /api/v1/health`
- `GET /api/v1/workflows`
- `POST /api/v1/workflows/:name/run`

## Registering Workflows

Use `registerWorkflow` to add workflows to the server:

```typescript
server.registerWorkflow("my-workflow", {
    workflow: myWorkflow,      // The Workflow instance
    startEvent: startEvent,    // Event that triggers the workflow
    stopEvent: stopEvent,      // Event that signals completion
});
```

### Multiple Workflows

```typescript
server.registerWorkflow("greeting", {
    workflow: greetingWorkflow,
    startEvent: greetStartEvent,
    stopEvent: greetStopEvent,
});

server.registerWorkflow("calculator", {
    workflow: calculatorWorkflow,
    startEvent: calcStartEvent,
    stopEvent: calcStopEvent,
});
```

## Error Handling

The server handles errors gracefully:

- **404** - Workflow not found
- **408** - Workflow timeout
- **500** - Internal server error

```typescript
// Workflow not found
POST /workflows/unknown/run
// Response: 404 { "error": "Workflow \"unknown\" not found" }

// Timeout
POST /workflows/slow/run { "data": "test", "timeout": 100 }
// Response: 408 { "error": "Workflow \"slow\" timed out after 100ms" }
```

## Programmatic Usage

You can also run workflows programmatically:

```typescript
const server = new WorkflowServer();

// Register workflows...

// Run a workflow directly
const result = await server.runWorkflow("greeting", "World");
console.log(result); // "Hello, World!"

// With timeout
const result = await server.runWorkflow("slow-workflow", data, 5000);
```

## OpenAPI Documentation

When `enableSwaggerUI` is `true` (default), Swagger UI is available at:

```
http://localhost:3000/documentation
```

This provides interactive API documentation with:
- Endpoint descriptions
- Request/response schemas
- Try-it-out functionality

## Dependencies

- **fastify** - Fast and low overhead web framework
- **@fastify/swagger** - OpenAPI specification generator
- **@fastify/swagger-ui** - Swagger UI integration
- **@llamaindex/workflow-core** - Core workflow engine

## License

MIT

