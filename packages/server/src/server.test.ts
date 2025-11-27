import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createWorkflowServer,
  WorkflowNotFoundError,
  WorkflowServer,
  WorkflowTimeoutError,
} from "./server";

// Test events
const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

const inputEvent = workflowEvent<{ value: number }>();
const outputEvent = workflowEvent<{ result: number }>();

// Create test workflows
function createEchoWorkflow() {
  const workflow = createWorkflow();
  workflow.handle([startEvent], (_context, event) => {
    return stopEvent.with(`Echo: ${event.data}`);
  });
  return workflow;
}

function createDoubleWorkflow() {
  const workflow = createWorkflow();
  workflow.handle([inputEvent], (_context, event) => {
    return outputEvent.with({ result: event.data.value * 2 });
  });
  return workflow;
}

function createSlowWorkflow(delay: number) {
  const workflow = createWorkflow();
  workflow.handle([startEvent], async (_context, event) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return stopEvent.with(`Slow: ${event.data}`);
  });
  return workflow;
}

describe("WorkflowServer", () => {
  describe("constructor and configuration", () => {
    it("should create a server with default options", () => {
      const server = new WorkflowServer();
      expect(server).toBeInstanceOf(WorkflowServer);
    });

    it("should create a server with custom options", () => {
      const server = new WorkflowServer({
        prefix: "/api/v1",
      });
      expect(server).toBeInstanceOf(WorkflowServer);
    });

    it("should create a server using factory function", () => {
      const server = createWorkflowServer();
      expect(server).toBeInstanceOf(WorkflowServer);
    });
  });

  describe("workflow registration", () => {
    it("should register a workflow", () => {
      const server = new WorkflowServer();
      const workflow = createEchoWorkflow();

      server.registerWorkflow("echo", {
        workflow,
        startEvent,
        stopEvent,
      });

      expect(server.getWorkflowNames()).toEqual(["echo"]);
    });

    it("should register multiple workflows", () => {
      const server = new WorkflowServer();

      server.registerWorkflow("echo", {
        workflow: createEchoWorkflow(),
        startEvent,
        stopEvent,
      });

      server.registerWorkflow("double", {
        workflow: createDoubleWorkflow(),
        startEvent: inputEvent,
        stopEvent: outputEvent,
      });

      expect(server.getWorkflowNames()).toEqual(["echo", "double"]);
    });

    it("should throw error when registering duplicate workflow", () => {
      const server = new WorkflowServer();
      const workflow = createEchoWorkflow();

      server.registerWorkflow("echo", {
        workflow,
        startEvent,
        stopEvent,
      });

      expect(() => {
        server.registerWorkflow("echo", {
          workflow,
          startEvent,
          stopEvent,
        });
      }).toThrow('Workflow "echo" is already registered');
    });

    it("should get workflow by name", () => {
      const server = new WorkflowServer();
      const workflow = createEchoWorkflow();

      server.registerWorkflow("echo", {
        workflow,
        startEvent,
        stopEvent,
      });

      const registered = server.getWorkflow("echo");
      expect(registered).toBeDefined();
      expect(registered?.name).toBe("echo");
      expect(registered?.workflow).toBe(workflow);
    });

    it("should return undefined for unknown workflow", () => {
      const server = new WorkflowServer();
      expect(server.getWorkflow("unknown")).toBeUndefined();
    });
  });

  describe("runWorkflow", () => {
    it("should run a workflow and return result", async () => {
      const server = new WorkflowServer();

      server.registerWorkflow("echo", {
        workflow: createEchoWorkflow(),
        startEvent,
        stopEvent,
      });

      const result = await server.runWorkflow("echo", "Hello");
      expect(result).toBe("Echo: Hello");
    });

    it("should run a workflow with object data", async () => {
      const server = new WorkflowServer();

      server.registerWorkflow("double", {
        workflow: createDoubleWorkflow(),
        startEvent: inputEvent,
        stopEvent: outputEvent,
      });

      const result = await server.runWorkflow<
        { value: number },
        { result: number }
      >("double", { value: 21 });
      expect(result).toEqual({ result: 42 });
    });

    it("should throw WorkflowNotFoundError for unknown workflow", async () => {
      const server = new WorkflowServer();

      await expect(server.runWorkflow("unknown", "data")).rejects.toThrow(
        WorkflowNotFoundError,
      );
    });

    it("should timeout slow workflows", async () => {
      const server = new WorkflowServer();

      server.registerWorkflow("slow", {
        workflow: createSlowWorkflow(500),
        startEvent,
        stopEvent,
      });

      await expect(server.runWorkflow("slow", "data", 100)).rejects.toThrow(
        WorkflowTimeoutError,
      );
    });
  });
});

describe("WorkflowServer HTTP endpoints", () => {
  let server: WorkflowServer;
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    server = new WorkflowServer();
    app = Fastify();

    // Register workflows
    server.registerWorkflow("echo", {
      workflow: createEchoWorkflow(),
      startEvent,
      stopEvent,
    });

    server.registerWorkflow("double", {
      workflow: createDoubleWorkflow(),
      startEvent: inputEvent,
      stopEvent: outputEvent,
    });

    await app.register(server.plugin());
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    });
  });

  describe("GET /workflows", () => {
    it("should return list of workflow names", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/workflows",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(["echo", "double"]);
    });

    it("should return empty array when no workflows registered", async () => {
      const emptyServer = new WorkflowServer();
      const emptyApp = Fastify();
      await emptyApp.register(emptyServer.plugin());

      const response = await emptyApp.inject({
        method: "GET",
        url: "/workflows",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);

      await emptyApp.close();
    });
  });

  describe("POST /workflows/:name/run", () => {
    it("should run a workflow and return result", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/workflows/echo/run",
        payload: { data: "Hello World" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ result: "Echo: Hello World" });
    });

    it("should run a workflow with object data", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/workflows/double/run",
        payload: { data: { value: 21 } },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ result: { result: 42 } });
    });

    it("should return 404 for unknown workflow", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/workflows/unknown/run",
        payload: { data: "test" },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: 'Workflow "unknown" not found',
      });
    });

    it("should respect custom timeout", async () => {
      server.registerWorkflow("slow", {
        workflow: createSlowWorkflow(500),
        startEvent,
        stopEvent,
      });

      const response = await app.inject({
        method: "POST",
        url: "/workflows/slow/run",
        payload: { data: "test", timeout: 100 },
      });

      expect(response.statusCode).toBe(408);
      expect(response.json().error).toContain("timed out");
    });
  });

  describe("with prefix", () => {
    it("should handle routes with prefix", async () => {
      const prefixedServer = new WorkflowServer({ prefix: "/api/v1" });
      prefixedServer.registerWorkflow("echo", {
        workflow: createEchoWorkflow(),
        startEvent,
        stopEvent,
      });

      const prefixedApp = Fastify();
      await prefixedApp.register(prefixedServer.plugin());

      const healthResponse = await prefixedApp.inject({
        method: "GET",
        url: "/api/v1/health",
      });
      expect(healthResponse.statusCode).toBe(200);

      const workflowsResponse = await prefixedApp.inject({
        method: "GET",
        url: "/api/v1/workflows",
      });
      expect(workflowsResponse.statusCode).toBe(200);
      expect(workflowsResponse.json()).toEqual(["echo"]);

      const runResponse = await prefixedApp.inject({
        method: "POST",
        url: "/api/v1/workflows/echo/run",
        payload: { data: "Prefixed" },
      });
      expect(runResponse.statusCode).toBe(200);
      expect(runResponse.json()).toEqual({ result: "Echo: Prefixed" });

      await prefixedApp.close();
    });
  });
});
