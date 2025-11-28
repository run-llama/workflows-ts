import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { HandlerStore } from "../handler-store";
import type { HandlerInfo, HandlerStatus } from "../types";

interface HandlerRoutesContext {
  prefix: string;
  handlerStore: HandlerStore;
}

export function registerHandlerRoutes(
  fastify: FastifyInstance,
  ctx: HandlerRoutesContext,
): void {
  const { prefix, handlerStore } = ctx;

  // GET /handlers
  fastify.get<{
    Querystring: { status?: HandlerStatus; workflow_name?: string };
    Reply: HandlerInfo[];
  }>(
    `${prefix}/handlers`,
    {
      schema: {
        description: "List all handlers with optional filters",
        tags: ["Handlers"],
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["running", "completed", "error", "cancelled"],
            },
            workflow_name: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                handlerId: { type: "string" },
                workflowName: { type: "string" },
                status: {
                  type: "string",
                  enum: ["running", "completed", "error", "cancelled"],
                },
                startedAt: { type: "string", format: "date-time" },
                completedAt: { type: "string", format: "date-time" },
                result: {},
                error: { type: "string" },
              },
              required: ["handlerId", "workflowName", "status", "startedAt"],
            },
          },
        },
      } as Record<string, unknown>,
    },
    async (
      request: FastifyRequest<{
        Querystring: { status?: HandlerStatus; workflow_name?: string };
      }>,
    ) => {
      const { status, workflow_name } = request.query;
      return handlerStore.list({
        status,
        workflowName: workflow_name,
      });
    },
  );

  // GET /handlers/:handlerId
  fastify.get<{
    Params: { handlerId: string };
    Reply: HandlerInfo | { error: string };
  }>(
    `${prefix}/handlers/:handlerId`,
    {
      schema: {
        description: "Get handler status and result",
        tags: ["Handlers"],
        params: {
          type: "object",
          properties: {
            handlerId: { type: "string" },
          },
          required: ["handlerId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              handlerId: { type: "string" },
              workflowName: { type: "string" },
              status: { type: "string" },
              startedAt: { type: "string", format: "date-time" },
              completedAt: { type: "string", format: "date-time" },
              result: {},
              error: { type: "string" },
            },
            required: ["handlerId", "workflowName", "status", "startedAt"],
          },
          202: {
            type: "object",
            properties: {
              handlerId: { type: "string" },
              workflowName: { type: "string" },
              status: { type: "string", enum: ["running"] },
              startedAt: { type: "string", format: "date-time" },
            },
            required: ["handlerId", "workflowName", "status", "startedAt"],
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
      request: FastifyRequest<{ Params: { handlerId: string } }>,
      reply: FastifyReply,
    ) => {
      const { handlerId } = request.params;
      const info = handlerStore.getInfo(handlerId);

      if (!info) {
        return reply
          .status(404)
          .send({ error: `Handler "${handlerId}" not found` });
      }

      const statusCode = info.status === "running" ? 202 : 200;
      return reply.status(statusCode).send(info);
    },
  );

  // GET /results/:handlerId (deprecated)
  fastify.get<{
    Params: { handlerId: string };
    Reply: { result: unknown } | { error: string };
  }>(
    `${prefix}/results/:handlerId`,
    {
      schema: {
        description:
          "Get handler result (deprecated, use /handlers/:handlerId)",
        tags: ["Handlers"],
        deprecated: true,
        params: {
          type: "object",
          properties: {
            handlerId: { type: "string" },
          },
          required: ["handlerId"],
        },
        response: {
          200: {
            type: "object",
            properties: { result: {} },
            required: ["result"],
          },
          202: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["running"] },
            },
            required: ["status"],
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
      request: FastifyRequest<{ Params: { handlerId: string } }>,
      reply: FastifyReply,
    ) => {
      const { handlerId } = request.params;
      const info = handlerStore.getInfo(handlerId);

      if (!info) {
        return reply
          .status(404)
          .send({ error: `Handler "${handlerId}" not found` });
      }

      if (info.status === "running") {
        return reply.status(202).send({ status: "running" });
      }

      if (info.status === "error") {
        return reply.status(500).send({ error: info.error });
      }

      return { result: info.result };
    },
  );
}
