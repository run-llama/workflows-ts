import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { HandlerStore } from "../handler-store";
import {
  CancelQuerySchema,
  CancelResponseSchema,
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

  // POST /handlers/:handlerId/cancel - Cancel a running handler
  fastify.post(`${prefix}/handlers/:handlerId/cancel`, {
    schema: {
      description:
        "Cancel a running handler. Optionally purge the handler from memory.",
      tags: ["Handlers"],
      params: toJsonSchema(HandlerIdParamsSchema),
      querystring: toJsonSchema(CancelQuerySchema),
      response: {
        200: toJsonSchema(CancelResponseSchema),
        400: toJsonSchema(ErrorResponseSchema),
        404: toJsonSchema(ErrorResponseSchema),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: z.infer<typeof HandlerIdParamsSchema>;
        Querystring: Record<string, string | undefined>;
      }>,
      reply: FastifyReply,
    ) => {
      const { handlerId } = request.params;
      // Parse purge manually since Fastify doesn't apply Zod transforms
      const purge = request.query.purge === "true";

      const info = handlerStore.getInfo(handlerId);
      if (!info) {
        return reply
          .status(404)
          .send({ error: `Handler "${handlerId}" not found` });
      }

      // Quick return if the handler is not running
      if (info.status !== "running") {
        return reply.status(400).send({
          error: `Handler "${handlerId}" is not running (status: ${info.status})`,
        });
      }

      const cancelled = handlerStore.cancel(handlerId);
      if (!cancelled) {
        return reply.status(400).send({
          error: `Failed to cancel handler "${handlerId}"`,
        });
      }
      if (purge) {
        handlerStore.delete(handlerId);
      }

      return {
        success: true,
        message: purge
          ? `Handler "${handlerId}" cancelled and purged`
          : `Handler "${handlerId}" cancelled`,
        handler_id: handlerId,
      };
    },
  });
}
