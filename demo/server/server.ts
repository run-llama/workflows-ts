/**
 * WorkflowServer Demo
 *
 * This demo shows how to use @llamaindex/workflow-server to expose
 * workflows as REST APIs with OpenAPI documentation.
 *
 * Run: pnpm start
 * Then visit: http://localhost:3000/documentation for Swagger UI
 */

import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { WorkflowServer } from "@llamaindex/workflow-server";
import Fastify from "fastify";

// ============================================
// Define Events
// ============================================

// Greeting workflow events
const greetStartEvent = workflowEvent<string>({
  debugLabel: "greetStart",
});
const greetStopEvent = workflowEvent<string>({
  debugLabel: "greetStop",
});

// Calculator workflow events
const calcInputEvent = workflowEvent<{ a: number; b: number; op: string }>({
  debugLabel: "calcInput",
});
const calcOutputEvent = workflowEvent<{ result: number }>({
  debugLabel: "calcOutput",
});

// Echo workflow events (for testing)
const echoStartEvent = workflowEvent<unknown>({
  debugLabel: "echoStart",
});
const echoStopEvent = workflowEvent<unknown>({
  debugLabel: "echoStop",
});

// ============================================
// Create Workflows
// ============================================

/**
 * Simple greeting workflow
 * Input: string (name)
 * Output: string (greeting message)
 */
const greetingWorkflow = createWorkflow();
greetingWorkflow.handle([greetStartEvent], (_context, event) => {
  const name = event.data || "World";
  return greetStopEvent.with(`Hello, ${name}! Welcome to the Workflow Server.`);
});

/**
 * Calculator workflow
 * Input: { a: number, b: number, op: string }
 * Output: { result: number }
 */
const calculatorWorkflow = createWorkflow();
calculatorWorkflow.handle([calcInputEvent], (_context, event) => {
  const { a, b, op } = event.data;
  let result: number;

  switch (op) {
    case "add":
      result = a + b;
      break;
    case "subtract":
      result = a - b;
      break;
    case "multiply":
      result = a * b;
      break;
    case "divide":
      if (b === 0) {
        throw new Error("Division by zero");
      }
      result = a / b;
      break;
    default:
      throw new Error(`Unknown operation: ${op}`);
  }

  return calcOutputEvent.with({ result });
});

/**
 * Echo workflow - returns whatever input it receives
 * Useful for testing and debugging
 */
const echoWorkflow = createWorkflow();
echoWorkflow.handle([echoStartEvent], (_context, event) => {
  return echoStopEvent.with(event.data);
});

// ============================================
// Create and Configure Server
// ============================================

const server = new WorkflowServer();

// Register workflows
server.registerWorkflow("greeting", {
  workflow: greetingWorkflow,
  startEvent: greetStartEvent,
  stopEvent: greetStopEvent,
});

server.registerWorkflow("calculator", {
  workflow: calculatorWorkflow,
  startEvent: calcInputEvent,
  stopEvent: calcOutputEvent,
});

server.registerWorkflow("echo", {
  workflow: echoWorkflow,
  startEvent: echoStartEvent,
  stopEvent: echoStopEvent,
});

// ============================================
// Start Fastify Server
// ============================================

const app = Fastify({
  logger: true,
});

// Register OpenAPI/Swagger documentation
await app.register(swagger, {
  openapi: {
    info: {
      title: "Workflow Server Demo",
      description:
        "A demo server showcasing @llamaindex/workflow-server capabilities",
      version: "1.0.0",
    },
  },
});

await app.register(swaggerUi, {
  routePrefix: "/documentation",
});

// Register the workflow server plugin
await app.register(server.plugin());

// Add a custom root route
app.get("/", async () => {
  return {
    message: "Workflow Server Demo",
    documentation: "/documentation",
    endpoints: {
      health: "GET /health",
      listWorkflows: "GET /workflows",
      runWorkflow: "POST /workflows/:name/run",
    },
    registeredWorkflows: server.getWorkflowNames(),
  };
});

// Start the server
const PORT = Number(process.env.PORT) || 3000;

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`
╔════════════════════════════════════════════════════════════╗
║              Workflow Server Demo Started                  ║
╠════════════════════════════════════════════════════════════╣
║  Server:        http://localhost:${PORT}                   ║
║  Swagger UI:    http://localhost:${PORT}/documentation     ║
║  Health:        http://localhost:${PORT}/health            ║
╠════════════════════════════════════════════════════════════╣
║  Registered Workflows:                                     ║
║    - greeting    : Simple greeting workflow                ║
║    - calculator  : Basic math operations                   ║
║    - echo        : Echo back input data                    ║
╚════════════════════════════════════════════════════════════╝

Try these commands:

  # List all workflows
  curl http://localhost:${PORT}/workflows

  # Run greeting workflow
  curl -X POST http://localhost:${PORT}/workflows/greeting/run \\
    -H "Content-Type: application/json" \\
    -d '{"data": "Alice"}'

  # Run calculator workflow
  curl -X POST http://localhost:${PORT}/workflows/calculator/run \\
    -H "Content-Type: application/json" \\
    -d '{"data": {"a": 10, "b": 5, "op": "multiply"}}'

  # Run echo workflow
  curl -X POST http://localhost:${PORT}/workflows/echo/run \\
    -H "Content-Type: application/json" \\
    -d '{"data": {"hello": "world", "nested": {"value": 42}}}'
`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
