# Workflow Server Demo

This demo shows how to use `@llamaindex/workflow-server` to expose LlamaIndex workflows as REST APIs with OpenAPI documentation.

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