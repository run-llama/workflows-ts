import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createWorkflowServer,
  WorkflowNotFoundError,
  WorkflowServer,
  WorkflowTimeoutError,
} from "./server";

const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();
const inputEvent = workflowEvent<{ value: number }>();
const outputEvent = workflowEvent<{ result: number }>();

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
      const server = new WorkflowServer({ prefix: "/api/v1" });
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
      server.registerWorkflow("echo", {
        workflow: createEchoWorkflow(),
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
      server.registerWorkflow("echo", { workflow, startEvent, stopEvent });
      expect(() => {
        server.registerWorkflow("echo", { workflow, startEvent, stopEvent });
      }).toThrow('Workflow "echo" is already registered');
    });

    it("should get workflow by name", () => {
      const server = new WorkflowServer();
      const workflow = createEchoWorkflow();
      server.registerWorkflow("echo", { workflow, startEvent, stopEvent });
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

  describe("runWorkflowAsync", () => {
    it("should start workflow and return handler info", () => {
      const server = new WorkflowServer();
      server.registerWorkflow("echo", {
        workflow: createEchoWorkflow(),
        startEvent,
        stopEvent,
      });
      const response = server.runWorkflowAsync("echo", "Hello");
      expect(response.handlerId).toBeDefined();
      expect(response.status).toBe("running");
    });

    it("should track handler status", async () => {
      const server = new WorkflowServer();
      server.registerWorkflow("echo", {
        workflow: createEchoWorkflow(),
        startEvent,
        stopEvent,
      });
      const { handlerId } = server.runWorkflowAsync("echo", "Hello");

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 50));

      const handler = server.getHandler(handlerId);
      expect(handler?.status).toBe("completed");
      expect(handler?.result).toBe("Echo: Hello");
    });

    it("should throw WorkflowNotFoundError for unknown workflow", () => {
      const server = new WorkflowServer();
      expect(() => server.runWorkflowAsync("unknown", "data")).toThrow(
        WorkflowNotFoundError,
      );
    });
  });

  describe("getHandlers", () => {
    it("should list all handlers", async () => {
      const server = new WorkflowServer();
      server.registerWorkflow("echo", {
        workflow: createEchoWorkflow(),
        startEvent,
        stopEvent,
      });
      server.runWorkflowAsync("echo", "Hello1");
      server.runWorkflowAsync("echo", "Hello2");

      const handlers = server.getHandlers();
      expect(handlers).toHaveLength(2);
    });

    it("should filter handlers by status", async () => {
      const server = new WorkflowServer();
      server.registerWorkflow("echo", {
        workflow: createEchoWorkflow(),
        startEvent,
        stopEvent,
      });
      server.registerWorkflow("slow", {
        workflow: createSlowWorkflow(200),
        startEvent,
        stopEvent,
      });

      server.runWorkflowAsync("echo", "fast");
      server.runWorkflowAsync("slow", "slow");

      await new Promise((resolve) => setTimeout(resolve, 50));

      const running = server.getHandlers({ status: "running" });
      const completed = server.getHandlers({ status: "completed" });

      expect(running).toHaveLength(1);
      expect(completed).toHaveLength(1);
    });

    it("should filter handlers by workflow name", async () => {
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

      server.runWorkflowAsync("echo", "test");
      server.runWorkflowAsync("double", { value: 1 });

      const echoHandlers = server.getHandlers({ workflowName: "echo" });
      expect(echoHandlers).toHaveLength(1);
      expect(echoHandlers[0].workflowName).toBe("echo");
    });
  });
});

describe("WorkflowServer HTTP endpoints", () => {
  let server: WorkflowServer;
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    server = new WorkflowServer();
    app = Fastify();

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

  describe("POST /workflows/:name/run-nowait", () => {
    it("should start workflow and return 202 with handler id", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/workflows/echo/run-nowait",
        payload: { data: "Hello" },
      });
      expect(response.statusCode).toBe(202);
      const body = response.json();
      expect(body.handlerId).toBeDefined();
      expect(body.status).toBe("running");
    });

    it("should return 404 for unknown workflow", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/workflows/unknown/run-nowait",
        payload: { data: "test" },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /handlers", () => {
    it("should return empty array when no handlers", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/handlers",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });

    it("should return list of handlers", async () => {
      await app.inject({
        method: "POST",
        url: "/workflows/echo/run-nowait",
        payload: { data: "test1" },
      });
      await app.inject({
        method: "POST",
        url: "/workflows/echo/run-nowait",
        payload: { data: "test2" },
      });

      const response = await app.inject({
        method: "GET",
        url: "/handlers",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(2);
    });

    it("should filter by status", async () => {
      server.registerWorkflow("slow", {
        workflow: createSlowWorkflow(200),
        startEvent,
        stopEvent,
      });

      await app.inject({
        method: "POST",
        url: "/workflows/echo/run-nowait",
        payload: { data: "fast" },
      });
      await app.inject({
        method: "POST",
        url: "/workflows/slow/run-nowait",
        payload: { data: "slow" },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const runningResponse = await app.inject({
        method: "GET",
        url: "/handlers?status=running",
      });
      expect(runningResponse.json()).toHaveLength(1);

      const completedResponse = await app.inject({
        method: "GET",
        url: "/handlers?status=completed",
      });
      expect(completedResponse.json()).toHaveLength(1);
    });

    it("should filter by workflow_name", async () => {
      await app.inject({
        method: "POST",
        url: "/workflows/echo/run-nowait",
        payload: { data: "test" },
      });
      await app.inject({
        method: "POST",
        url: "/workflows/double/run-nowait",
        payload: { data: { value: 1 } },
      });

      const response = await app.inject({
        method: "GET",
        url: "/handlers?workflow_name=echo",
      });
      expect(response.json()).toHaveLength(1);
      expect(response.json()[0].workflowName).toBe("echo");
    });
  });

  describe("GET /handlers/:handlerId", () => {
    it("should return 404 for unknown handler", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/handlers/unknown-id",
      });
      expect(response.statusCode).toBe(404);
    });

    it("should return 202 for running handler", async () => {
      server.registerWorkflow("slow", {
        workflow: createSlowWorkflow(200),
        startEvent,
        stopEvent,
      });

      const startResponse = await app.inject({
        method: "POST",
        url: "/workflows/slow/run-nowait",
        payload: { data: "test" },
      });
      const { handlerId } = startResponse.json();

      const response = await app.inject({
        method: "GET",
        url: `/handlers/${handlerId}`,
      });
      expect(response.statusCode).toBe(202);
      expect(response.json().status).toBe("running");
    });

    it("should return 200 with result for completed handler", async () => {
      const startResponse = await app.inject({
        method: "POST",
        url: "/workflows/echo/run-nowait",
        payload: { data: "Hello" },
      });
      const { handlerId } = startResponse.json();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = await app.inject({
        method: "GET",
        url: `/handlers/${handlerId}`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe("completed");
      expect(response.json().result).toBe("Echo: Hello");
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

      const runNowaitResponse = await prefixedApp.inject({
        method: "POST",
        url: "/api/v1/workflows/echo/run-nowait",
        payload: { data: "Prefixed" },
      });
      expect(runNowaitResponse.statusCode).toBe(202);

      const handlersResponse = await prefixedApp.inject({
        method: "GET",
        url: "/api/v1/handlers",
      });
      expect(handlersResponse.statusCode).toBe(200);

      await prefixedApp.close();
    });
  });
});
