import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { HandlerStore } from "../handler-store";
import {
  ErrorResponseSchema,
  HandlerIdParamsSchema,
  HandlerInfoSchema,
  HandlersQuerySchema,
  toJsonSchema,
} from "../schemas";

interface HandlerRoutesContext {
  prefix: string;
  handlerStore: HandlerStore;
}

export function registerHandlerRoutes(
  fastify: FastifyInstance,
  ctx: HandlerRoutesContext,
): void {
  const { prefix, handlerStore } = ctx;

  fastify.get(`${prefix}/handlers`, {
    schema: {
      description: "List all handlers with optional filters",
      tags: ["Handlers"],
      querystring: toJsonSchema(HandlersQuerySchema),
      response: {
        200: toJsonSchema(z.array(HandlerInfoSchema)),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: z.infer<typeof HandlersQuerySchema>;
      }>,
    ) => {
      const { status, workflow_name } = request.query;
      return handlerStore.list({ status, workflowName: workflow_name });
    },
  });

  fastify.get(`${prefix}/handlers/:handlerId`, {
    schema: {
      description: "Get handler status and result",
      tags: ["Handlers"],
      params: toJsonSchema(HandlerIdParamsSchema),
      response: {
        200: toJsonSchema(HandlerInfoSchema),
        202: toJsonSchema(HandlerInfoSchema),
        404: toJsonSchema(ErrorResponseSchema),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: z.infer<typeof HandlerIdParamsSchema>;
      }>,
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
  });
}
