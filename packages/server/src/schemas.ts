import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

type JsonSchema = ReturnType<typeof zodToJsonSchema>;

export function toJsonSchema(schema: z.ZodType): JsonSchema {
  return zodToJsonSchema(schema, { $refStrategy: "none" });
}

// Common schemas
export const ErrorResponseSchema = z.object({
  error: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Health
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// Handler
export const HandlerStatusSchema = z.enum([
  "running",
  "completed",
  "error",
  "cancelled",
]);
export type HandlerStatus = z.infer<typeof HandlerStatusSchema>;

export const HandlerInfoSchema = z.object({
  handlerId: z.string(),
  workflowName: z.string(),
  status: HandlerStatusSchema,
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});
export type HandlerInfo = z.infer<typeof HandlerInfoSchema>;

// Workflow run
export const WorkflowRunRequestSchema = z.object({
  data: z.unknown(),
  timeout: z.number().optional().default(30000),
});
export type WorkflowRunRequest = z.infer<typeof WorkflowRunRequestSchema>;

export const WorkflowRunResponseSchema = z.object({
  result: z.unknown(),
});
export type WorkflowRunResponse = z.infer<typeof WorkflowRunResponseSchema>;

export const WorkflowRunAsyncResponseSchema = z.object({
  handlerId: z.string(),
  status: z.literal("running"),
});
export type WorkflowRunAsyncResponse = z.infer<
  typeof WorkflowRunAsyncResponseSchema
>;

// Route params
export const WorkflowNameParamsSchema = z.object({
  name: z.string(),
});

export const HandlerIdParamsSchema = z.object({
  handlerId: z.string(),
});

// Query params
export const HandlersQuerySchema = z.object({
  status: HandlerStatusSchema.optional(),
  workflow_name: z.string().optional(),
});
