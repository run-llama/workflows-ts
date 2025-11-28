import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "../types";

export function registerHealthRoutes(
  fastify: FastifyInstance,
  prefix: string,
): void {
  fastify.get<{ Reply: HealthResponse }>(
    `${prefix}/health`,
    {
      schema: {
        description: "Health check endpoint",
        tags: ["Health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ok"] },
            },
            required: ["status"],
          },
        },
      } as Record<string, unknown>,
    },
    async () => {
      return { status: "ok" };
    },
  );
}
