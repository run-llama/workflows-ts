import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { WorkflowNotFoundError, WorkflowTimeoutError } from "../errors";
import type {
  RegisteredWorkflow,
  WorkflowRunAsyncResponse,
  WorkflowRunRequest,
  WorkflowRunResponse,
} from "../types";

const DEFAULT_TIMEOUT = 30_000;

interface WorkflowRoutesContext {
  prefix: string;
  getWorkflow: (name: string) => RegisteredWorkflow | undefined;
  getWorkflowNames: () => string[];
  runWorkflow: <TStartData, TStopData>(
    name: string,
    data: TStartData,
    timeout?: number,
  ) => Promise<TStopData>;
  runWorkflowAsync: (name: string, data: unknown) => WorkflowRunAsyncResponse;
}

export function registerWorkflowRoutes(
  fastify: FastifyInstance,
  ctx: WorkflowRoutesContext,
): void {
  const { prefix } = ctx;

  // GET /workflows
  fastify.get<{ Reply: string[] }>(
    `${prefix}/workflows`,
    {
      schema: {
        description: "List all registered workflow names",
        tags: ["Workflows"],
        response: {
          200: {
            type: "array",
            items: { type: "string" },
          },
        },
      } as Record<string, unknown>,
    },
    async () => {
      return ctx.getWorkflowNames();
    },
  );

  // POST /workflows/:name/run
  fastify.post<{
    Params: { name: string };
    Body: WorkflowRunRequest;
    Reply: WorkflowRunResponse | { error: string };
  }>(
    `${prefix}/workflows/:name/run`,
    {
      schema: {
        description: "Run a workflow synchronously and wait for completion",
        tags: ["Workflows"],
        params: {
          type: "object",
          properties: {
            name: { type: "string", description: "Workflow name" },
          },
          required: ["name"],
        },
        body: {
          type: "object",
          properties: {
            data: { description: "Data to pass to the start event" },
            timeout: {
              type: "number",
              description: "Timeout in milliseconds",
              default: 30000,
            },
          },
          required: ["data"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              result: { description: "The result from the workflow" },
            },
            required: ["result"],
          },
          404: {
            type: "object",
            properties: { error: { type: "string" } },
            required: ["error"],
          },
          408: {
            type: "object",
            properties: { error: { type: "string" } },
            required: ["error"],
          },
          500: {
            type: "object",
            properties: { error: { type: "string" } },
            required: ["error"],
          },
        },
      } as Record<string, unknown>,
    },
    async (
      request: FastifyRequest<{
        Params: { name: string };
        Body: WorkflowRunRequest;
      }>,
      reply: FastifyReply,
    ) => {
      const { name } = request.params;
      const { data, timeout = DEFAULT_TIMEOUT } = request.body;

      if (!ctx.getWorkflow(name)) {
        return reply
          .status(404)
          .send({ error: `Workflow "${name}" not found` });
      }

      try {
        const result = await ctx.runWorkflow(name, data, timeout);
        return { result };
      } catch (error) {
        if (error instanceof WorkflowNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        if (error instanceof WorkflowTimeoutError) {
          return reply.status(408).send({ error: error.message });
        }
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({ error: message });
      }
    },
  );

  // POST /workflows/:name/run-nowait
  fastify.post<{
    Params: { name: string };
    Body: WorkflowRunRequest;
    Reply: WorkflowRunAsyncResponse | { error: string };
  }>(
    `${prefix}/workflows/:name/run-nowait`,
    {
      schema: {
        description: "Start a workflow asynchronously and return immediately",
        tags: ["Workflows"],
        params: {
          type: "object",
          properties: {
            name: { type: "string", description: "Workflow name" },
          },
          required: ["name"],
        },
        body: {
          type: "object",
          properties: {
            data: { description: "Data to pass to the start event" },
          },
          required: ["data"],
        },
        response: {
          202: {
            type: "object",
            properties: {
              handlerId: { type: "string" },
              status: { type: "string", enum: ["running"] },
            },
            required: ["handlerId", "status"],
          },
          404: {
            type: "object",
            properties: { error: { type: "string" } },
            required: ["error"],
          },
        },
      } as Record<string, unknown>,
    },
    async (
      request: FastifyRequest<{
        Params: { name: string };
        Body: WorkflowRunRequest;
      }>,
      reply: FastifyReply,
    ) => {
      const { name } = request.params;
      const { data } = request.body;

      if (!ctx.getWorkflow(name)) {
        return reply
          .status(404)
          .send({ error: `Workflow "${name}" not found` });
      }

      const response = ctx.runWorkflowAsync(name, data);
      return reply.status(202).send(response);
    },
  );
}
