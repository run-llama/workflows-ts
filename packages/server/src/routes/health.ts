import type { FastifyInstance } from "fastify";
import { HealthResponseSchema, toJsonSchema } from "../schemas";

export function registerHealthRoutes(
  fastify: FastifyInstance,
  prefix: string,
): void {
  fastify.get(`${prefix}/health`, {
    schema: {
      description: "Health check endpoint",
      tags: ["Health"],
      response: {
        200: toJsonSchema(HealthResponseSchema),
      },
    },
    handler: async () => ({ status: "ok" as const }),
  });
}
