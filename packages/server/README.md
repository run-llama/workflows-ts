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
import { createWorkflowServer, fastifyPlugin } from "@llamaindex/workflow-server";
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";

// Define events
const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

// Create workflow
const greetingWorkflow = createWorkflow();
greetingWorkflow.handle([startEvent], (_context, event) => {
    return stopEvent.with(`Hello, ${event.data}!`);
});

// Create server with initial workflows
const workflowServer = createWorkflowServer({
    greeting: {
        workflow: greetingWorkflow,
        startEvent,
        stopEvent,
    },
});

// Start Fastify
const app = Fastify({ logger: true });
await app.register(fastifyPlugin(workflowServer));
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
import { createWorkflowServer, fastifyPlugin } from "@llamaindex/workflow-server";

const workflowServer = createWorkflowServer({
    // ... workflows
});

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
await app.register(fastifyPlugin(workflowServer));
await app.listen({ port: 3000 });
```

Swagger UI will be available at `http://localhost:3000/documentation`.

## Registering Workflows

### Using createWorkflowServer Factory (Recommended)

```typescript
const workflowServer = createWorkflowServer({
    greeting: {
        workflow: greetingWorkflow,
        startEvent: greetStartEvent,
        stopEvent: greetStopEvent,
    },
    calculator: {
        workflow: calculatorWorkflow,
        startEvent: calcStartEvent,
        stopEvent: calcStopEvent,
    },
});
```

### Using register Method

You can also use `register` to add workflows after creation:

```typescript
const workflowServer = createWorkflowServer();

workflowServer
    .register("greeting", {
        workflow: greetingWorkflow,
        startEvent: greetStartEvent,
        stopEvent: greetStopEvent,
    })
    .register("calculator", {
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
