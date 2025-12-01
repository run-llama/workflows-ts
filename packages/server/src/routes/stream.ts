import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import type { HandlerStore } from "../handler-store";
import {
  ErrorResponseSchema,
  HandlerIdParamsSchema,
  StreamQuerySchema,
  toJsonSchema,
} from "../schemas";
import type { StreamEvent } from "../types";

interface StreamRoutesContext {
  prefix: string;
  handlerStore: HandlerStore;
}

export interface StreamOptions {
  sse: boolean;
  includeQualifiedName: boolean;
}

export function parseStreamQueryParams(
  query: Record<string, string | undefined>,
): {
  sse: boolean;
  acquireTimeout: number;
  includeQualifiedName: boolean;
} {
  return {
    sse: query.sse !== "false",
    acquireTimeout: query.acquire_timeout ? Number(query.acquire_timeout) : 1,
    includeQualifiedName: query.include_qualified_name !== "false",
  };
}

export function formatEventAsSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function formatEventAsNDJSON(event: StreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export function formatEvent(
  event: StreamEvent,
  options: StreamOptions,
): string {
  const eventData: StreamEvent = options.includeQualifiedName
    ? event
    : { type: event.type, data: event.data };

  return options.sse
    ? formatEventAsSSE(eventData)
    : formatEventAsNDJSON(eventData);
}

export function formatCompletionEvent(
  status: string,
  result: unknown,
  error: string | undefined,
): string {
  const completionEvent = {
    type: "__stream_complete__",
    status,
    result,
    error,
  };
  return formatEventAsSSE(completionEvent);
}

export interface StreamGeneratorDeps {
  getQueuedEvents: (handlerId: string) => StreamEvent[] | undefined;
  getHandlerStatus: (handlerId: string) => string | undefined;
  getHandlerResult: (
    handlerId: string,
  ) => { result: unknown; error: string | undefined } | undefined;
  releaseStreamLock: (handlerId: string) => void;
  pollInterval?: number;
}

export async function* createStreamGenerator(
  handlerId: string,
  options: StreamOptions,
  deps: StreamGeneratorDeps,
): AsyncGenerator<string> {
  const pollInterval = deps.pollInterval ?? 50;

  try {
    // Keep streaming until handler completes or client disconnects
    while (true) {
      const events = deps.getQueuedEvents(handlerId);
      if (events && events.length > 0) {
        for (const event of events) {
          yield formatEvent(event, options);
        }
      }

      const status = deps.getHandlerStatus(handlerId);
      if (!status || status !== "running") {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // Send final completion event if SSE
    if (options.sse) {
      const handlerData = deps.getHandlerResult(handlerId);
      const status = deps.getHandlerStatus(handlerId);
      if (status && handlerData) {
        yield formatCompletionEvent(
          status,
          handlerData.result,
          handlerData.error,
        );
      }
    }
  } finally {
    deps.releaseStreamLock(handlerId);
  }
}

export function registerStreamRoutes(
  fastify: FastifyInstance,
  ctx: StreamRoutesContext,
): void {
  const { prefix, handlerStore } = ctx;

  fastify.get(`${prefix}/events/:handlerId/stream`, {
    schema: {
      description:
        "Stream workflow events in SSE or NDJSON format. Only one consumer can stream at a time.",
      tags: ["Events"],
      params: toJsonSchema(HandlerIdParamsSchema),
      querystring: toJsonSchema(StreamQuerySchema),
      response: {
        404: toJsonSchema(ErrorResponseSchema),
        409: toJsonSchema(ErrorResponseSchema),
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
      const { sse, acquireTimeout, includeQualifiedName } =
        parseStreamQueryParams(request.query);

      const handler = handlerStore.get(handlerId);
      if (!handler) {
        return reply
          .status(404)
          .send({ error: `Handler "${handlerId}" not found` });
      }

      const acquired = await handlerStore.acquireStreamLock(
        handlerId,
        acquireTimeout,
      );
      if (!acquired) {
        return reply.status(409).send({
          error: `Stream is already being consumed by another client. Try again later.`,
        });
      }

      // Set up response headers
      if (sse) {
        reply.raw.setHeader("Content-Type", "text/event-stream");
        reply.raw.setHeader("Cache-Control", "no-cache");
        reply.raw.setHeader("Connection", "keep-alive");
      } else {
        reply.raw.setHeader("Content-Type", "application/x-ndjson");
      }

      // Handle client disconnect
      request.raw.on("close", () => {
        handlerStore.releaseStreamLock(handlerId);
      });

      const streamGenerator = createStreamGenerator(
        handlerId,
        { sse, includeQualifiedName },
        {
          getQueuedEvents: (id) => handlerStore.getQueuedEvents(id),
          getHandlerStatus: (id) => handlerStore.get(id)?.info.status,
          getHandlerResult: (id) => {
            const h = handlerStore.get(id);
            return h
              ? { result: h.info.result, error: h.info.error }
              : undefined;
          },
          releaseStreamLock: (id) => handlerStore.releaseStreamLock(id),
        },
      );

      reply.raw.statusCode = 200;

      for await (const chunk of streamGenerator) {
        reply.raw.write(chunk);
      }

      reply.raw.end();
      return reply;
    },
  });
}
