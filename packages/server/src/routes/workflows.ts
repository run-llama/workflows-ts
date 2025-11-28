import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { WorkflowNotFoundError, WorkflowTimeoutError } from "../errors";
import {
  ErrorResponseSchema,
  toJsonSchema,
  WorkflowNameParamsSchema,
  WorkflowRunAsyncResponseSchema,
  WorkflowRunRequestSchema,
  WorkflowRunResponseSchema,
} from "../schemas";
import type { RegisteredWorkflow, WorkflowRunAsyncResponse } from "../types";

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

  fastify.get(`${prefix}/workflows`, {
    schema: {
      description: "List all registered workflow names",
      tags: ["Workflows"],
      response: {
        200: toJsonSchema(z.array(z.string())),
      },
    },
    handler: async () => ctx.getWorkflowNames(),
  });

  fastify.post(`${prefix}/workflows/:name/run`, {
    schema: {
      description: "Run a workflow synchronously and wait for completion",
      tags: ["Workflows"],
      params: toJsonSchema(WorkflowNameParamsSchema),
      body: toJsonSchema(WorkflowRunRequestSchema),
      response: {
        200: toJsonSchema(WorkflowRunResponseSchema),
        404: toJsonSchema(ErrorResponseSchema),
        408: toJsonSchema(ErrorResponseSchema),
        500: toJsonSchema(ErrorResponseSchema),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: z.infer<typeof WorkflowNameParamsSchema>;
        Body: z.infer<typeof WorkflowRunRequestSchema>;
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
  });

  fastify.post(`${prefix}/workflows/:name/run-nowait`, {
    schema: {
      description: "Start a workflow asynchronously and return immediately",
      tags: ["Workflows"],
      params: toJsonSchema(WorkflowNameParamsSchema),
      body: toJsonSchema(WorkflowRunRequestSchema.omit({ timeout: true })),
      response: {
        202: toJsonSchema(WorkflowRunAsyncResponseSchema),
        404: toJsonSchema(ErrorResponseSchema),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: z.infer<typeof WorkflowNameParamsSchema>;
        Body: { data: unknown };
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
  });
}
