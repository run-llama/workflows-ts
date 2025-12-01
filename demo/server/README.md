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

### Run Workflow and Stream Events

Run example Echo workflow that print out a message multiple times with streaming events:

```bash
HANDLER_ID=$(curl -s -X POST http://localhost:3000/workflows/echo/run-nowait -H "Content-Type: application/json" -d '{"data":{"message":"Hello World","times":3,"delay":1000}}' | grep -o '"handlerId":"[^"]*"' | cut -d'"' -f4) && curl -N http://localhost:3000/events/$HANDLER_ID/stream?sse=true
```

**Expected Output:**
```
data: {"type":"echoStart","data":{"message":"Hello World","times":3,"delay":1000},"qualified_name":"echoStart"}

data: {"type":"echo","data":"Hello World","qualified_name":"echo"}

data: {"type":"echo","data":"Hello World","qualified_name":"echo"}

data: {"type":"echo","data":"Hello World","qualified_name":"echo"}

data: {"type":"echoStop","data":"Echoed \"Hello World\" 3 time(s)","qualified_name":"echoStop"}

data: {"status":"completed","result":"Echoed \"Hello World\" 3 time(s)"}
```

**Note:** The `times` parameter defaults to 1, and `delay` defaults to 1000ms (1 second) between each echo.

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