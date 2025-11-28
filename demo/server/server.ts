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
import {
  createWorkflowServer,
  fastifyPlugin,
} from "@llamaindex/workflow-server";
import Fastify from "fastify";
import {
  calculatorWorkflow,
  calcInputEvent,
  calcOutputEvent,
  echoWorkflow,
  echoStartEvent,
  echoStopEvent,
  greetingWorkflow,
  greetStartEvent,
  greetStopEvent,
} from "./workflows";

// ============================================
// Create and Configure Server
// ============================================

const workflowServer = createWorkflowServer({
  greeting: {
    workflow: greetingWorkflow,
    startEvent: greetStartEvent,
    stopEvent: greetStopEvent,
  },
  calculator: {
    workflow: calculatorWorkflow,
    startEvent: calcInputEvent,
    stopEvent: calcOutputEvent,
  },
  echo: {
    workflow: echoWorkflow,
    startEvent: echoStartEvent,
    stopEvent: echoStopEvent,
  },
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
await app.register(fastifyPlugin(workflowServer));

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
    registeredWorkflows: workflowServer.getWorkflowNames(),
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
