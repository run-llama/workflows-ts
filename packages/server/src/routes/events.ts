import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { HandlerNotFoundError } from "../errors";
import type { HandlerStore } from "../handler-store";
import {
  ErrorResponseSchema,
  EventSchemaSchema,
  HandlerIdParamsSchema,
  SendEventRequestSchema,
  SendEventResponseSchema,
  toJsonSchema,
  WorkflowEventsResponseSchema,
  WorkflowNameParamsSchema,
  WorkflowSchemaResponseSchema,
} from "../schemas";
import type {
  EventSchema,
  RegisteredWorkflow,
  WorkflowEventWithSchema,
} from "../types";

interface EventRoutesContext {
  prefix: string;
  getWorkflow: (name: string) => RegisteredWorkflow | undefined;
  handlerStore: HandlerStore;
}

/**
 * Extract JSON schema from a WorkflowEvent.
 * If the event was created with zodEvent(), it will have a `schema` property
 * that can be converted to JSON schema.
 */
function extractEventSchema(
  event: WorkflowEventWithSchema<unknown>,
): EventSchema {
  const schema: EventSchema = {
    uniqueId: event.uniqueId,
    debugLabel: event.debugLabel,
  };

  // If the event has a Zod schema attached (from zodEvent), convert it to JSON schema
  if ("schema" in event && event.schema != null) {
    try {
      // Try to use zod-to-json-schema for Zod schemas
      // The schema could be Zod 3 or Zod 4
      const zodSchema = event.schema;
      // Check if it's a Zod schema by looking for typical Zod properties
      if (
        typeof zodSchema === "object" &&
        zodSchema !== null &&
        ("_def" in zodSchema || "_zod" in zodSchema)
      ) {
        // Use zodToJsonSchema dynamically if available
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { zodToJsonSchema } = require("zod-to-json-schema");
          schema.schema = zodToJsonSchema(zodSchema, { $refStrategy: "none" });
        } catch {
          // If zod-to-json-schema is not available, store raw schema description
          schema.schema = { type: "unknown", description: "Zod schema" };
        }
      }
    } catch {
      // If schema extraction fails, just skip it
    }
  }

  return schema;
}

/**
 * Get all events for a workflow (start, stop, and additional events).
 */
function getWorkflowEvents(workflow: RegisteredWorkflow): EventSchema[] {
  const events: EventSchema[] = [];

  events.push(extractEventSchema(workflow.startEvent));
  events.push(extractEventSchema(workflow.stopEvent));

  if (workflow.additionalEvents) {
    for (const event of workflow.additionalEvents) {
      events.push(extractEventSchema(event));
    }
  }

  return events;
}

/**
 * Find an event by its uniqueId from a workflow's events.
 */
function findEventByType(
  workflow: RegisteredWorkflow,
  eventType: string,
): WorkflowEventWithSchema<unknown> | undefined {
  if (workflow.startEvent.uniqueId === eventType) {
    return workflow.startEvent;
  }
  if (workflow.stopEvent.uniqueId === eventType) {
    return workflow.stopEvent;
  }
  if (workflow.additionalEvents) {
    for (const event of workflow.additionalEvents) {
      if (event.uniqueId === eventType) {
        return event;
      }
    }
  }
  return undefined;
}

export function registerEventRoutes(
  fastify: FastifyInstance,
  ctx: EventRoutesContext,
): void {
  const { prefix, handlerStore } = ctx;

  // GET /workflows/:name/schema - Get JSON schema for start and stop events
  fastify.get(`${prefix}/workflows/:name/schema`, {
    schema: {
      description: "Get JSON schema for start and stop events of a workflow",
      tags: ["Workflows"],
      params: toJsonSchema(WorkflowNameParamsSchema),
      response: {
        200: toJsonSchema(WorkflowSchemaResponseSchema),
        404: toJsonSchema(ErrorResponseSchema),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: z.infer<typeof WorkflowNameParamsSchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const { name } = request.params;
      const workflow = ctx.getWorkflow(name);

      if (!workflow) {
        return reply
          .status(404)
          .send({ error: `Workflow "${name}" not found` });
      }

      return {
        startEvent: extractEventSchema(workflow.startEvent),
        stopEvent: extractEventSchema(workflow.stopEvent),
      };
    },
  });

  // GET /workflows/:name/events - List all event schemas for a workflow
  fastify.get(`${prefix}/workflows/:name/events`, {
    schema: {
      description: "List all event schemas for a workflow",
      tags: ["Workflows"],
      params: toJsonSchema(WorkflowNameParamsSchema),
      response: {
        200: toJsonSchema(WorkflowEventsResponseSchema),
        404: toJsonSchema(ErrorResponseSchema),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: z.infer<typeof WorkflowNameParamsSchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const { name } = request.params;
      const workflow = ctx.getWorkflow(name);

      if (!workflow) {
        return reply
          .status(404)
          .send({ error: `Workflow "${name}" not found` });
      }

      return getWorkflowEvents(workflow);
    },
  });

  // POST /events/:handlerId - Send event to a running workflow
  fastify.post(`${prefix}/events/:handlerId`, {
    schema: {
      description: "Send an event to a running workflow handler",
      tags: ["Events"],
      params: toJsonSchema(HandlerIdParamsSchema),
      body: toJsonSchema(SendEventRequestSchema),
      response: {
        200: toJsonSchema(SendEventResponseSchema),
        400: toJsonSchema(ErrorResponseSchema),
        404: toJsonSchema(ErrorResponseSchema),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: z.infer<typeof HandlerIdParamsSchema>;
        Body: z.infer<typeof SendEventRequestSchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const { handlerId } = request.params;
      const { eventType, data } = request.body;

      const handler = handlerStore.get(handlerId);
      if (!handler) {
        return reply
          .status(404)
          .send({ error: `Handler "${handlerId}" not found` });
      }

      // Check if handler is still running
      if (handler.info.status !== "running") {
        return reply.status(400).send({
          error: `Handler "${handlerId}" is not running (status: ${handler.info.status})`,
        });
      }

      // Get the workflow to find the event type
      const workflow = ctx.getWorkflow(handler.info.workflowName);
      if (!workflow) {
        return reply.status(404).send({
          error: `Workflow "${handler.info.workflowName}" not found`,
        });
      }

      // Find the event by type
      const event = findEventByType(workflow, eventType);
      if (!event) {
        return reply.status(400).send({
          error: `Event type "${eventType}" not found in workflow "${handler.info.workflowName}"`,
        });
      }

      // Create event data and send it
      try {
        const eventData = event.with(data);
        handler.sendEvent(eventData);

        return {
          success: true,
          message: `Event "${eventType}" sent to handler "${handlerId}"`,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send event";
        return reply.status(400).send({ error: message });
      }
    },
  });
}
