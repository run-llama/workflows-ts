import type { WorkflowContext } from "@llamaindex/workflow-core";
import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type {
  HandlerInfo,
  HandlerStatus,
  HealthResponse,
  RegisteredWorkflow,
  WorkflowConfig,
  WorkflowRunRequest,
  WorkflowRunResponse,
  WorkflowServerOptions,
} from "./types";

export class WorkflowNotFoundError extends Error {
  constructor(name: string) {
    super(`Workflow "${name}" not found`);
    this.name = "WorkflowNotFoundError";
  }
}

export class WorkflowTimeoutError extends Error {
  constructor(name: string, timeout: number) {
    super(`Workflow "${name}" timed out after ${timeout}ms`);
    this.name = "WorkflowTimeoutError";
  }
}

/**
 * Default timeout for sync workflow execution (30 seconds).
 */
const DEFAULT_TIMEOUT = 30_000;

interface HandlerContext {
  info: HandlerInfo;
  context: WorkflowContext;
  sendEvent: WorkflowContext["sendEvent"];
}

/**
 * WorkflowServer provides a Fastify plugin that exposes workflow operations
 * through a RESTful API with OpenAPI documentation.
 *
 * @example
 * ```typescript
 * import Fastify from "fastify";
 * import { WorkflowServer } from "@llamaindex/workflow-server";
 * import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
 *
 * const startEvent = workflowEvent<string>();
 * const stopEvent = workflowEvent<string>();
 *
 * const myWorkflow = createWorkflow();
 * myWorkflow.handle([startEvent], (ctx, event) => {
 *   return stopEvent.with(`Processed: ${event.data}`);
 * });
 *
 * const server = new WorkflowServer();
 * server.registerWorkflow("my-workflow", {
 *   workflow: myWorkflow,
 *   startEvent,
 *   stopEvent,
 * });
 *
 * const app = Fastify();
 * await app.register(server.plugin());
 * await app.listen({ port: 3000 });
 * ```
 */
export class WorkflowServer {
  private workflows: Map<string, RegisteredWorkflow> = new Map();
  private handlers: Map<string, HandlerContext> = new Map();
  private options: Required<WorkflowServerOptions>;

  constructor(options: WorkflowServerOptions = {}) {
    this.options = {
      prefix: options.prefix ?? "",
    };
  }

  /**
   * Register a workflow with the server.
   *
   * @param name - Unique name for the workflow
   * @param config - Workflow configuration including the workflow, start event, and stop event
   */
  registerWorkflow<TStartData = unknown, TStopData = unknown>(
    name: string,
    config: WorkflowConfig<TStartData, TStopData>,
  ): void {
    if (this.workflows.has(name)) {
      throw new Error(`Workflow "${name}" is already registered`);
    }

    this.workflows.set(name, {
      ...config,
      name,
    });
  }

  getWorkflow(name: string): RegisteredWorkflow | undefined {
    return this.workflows.get(name);
  }

  getWorkflowNames(): string[] {
    return Array.from(this.workflows.keys());
  }

  getHandler(handlerId: string): HandlerInfo | undefined {
    return this.handlers.get(handlerId)?.info;
  }

  getHandlers(filters?: {
    status?: HandlerStatus;
    workflowName?: string;
  }): HandlerInfo[] {
    let result = Array.from(this.handlers.values()).map((h) => h.info);

    if (filters?.status) {
      result = result.filter((h) => h.status === filters.status);
    }

    if (filters?.workflowName) {
      result = result.filter((h) => h.workflowName === filters.workflowName);
    }

    return result;
  }

  /**
   * Run a workflow synchronously, waiting for completion.
   *
   * @param name - Name of the workflow to run
   * @param data - Data to pass to the start event
   * @param timeout - Timeout in milliseconds (default: 30000)
   * @returns The result from the stop event
   */
  async runWorkflow<TStartData, TStopData>(
    name: string,
    data: TStartData,
    timeout: number = DEFAULT_TIMEOUT,
  ): Promise<TStopData> {
    const registered = this.workflows.get(name);
    if (!registered) {
      throw new WorkflowNotFoundError(name);
    }

    const { workflow, startEvent, stopEvent } =
      registered as RegisteredWorkflow<TStartData, TStopData>;

    const { stream, sendEvent } = workflow.createContext();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new WorkflowTimeoutError(name, timeout));
      }, timeout);
    });

    sendEvent(startEvent.with(data));

    const resultPromise = (async () => {
      for await (const event of stream) {
        if (stopEvent.include(event)) {
          return event.data as TStopData;
        }
      }
      throw new Error(`Workflow "${name}" completed without stop event`);
    })();

    return Promise.race([resultPromise, timeoutPromise]);
  }

  /**
   * Create a Fastify plugin that registers all workflow routes.
   *
   * Note: For OpenAPI/Swagger documentation, register @fastify/swagger
   * and @fastify/swagger-ui BEFORE registering this plugin:
   *
   * @example
   * ```typescript
   * import swagger from "@fastify/swagger";
   * import swaggerUi from "@fastify/swagger-ui";
   *
   * await app.register(swagger, { openapi: { info: { title: "My API", version: "1.0.0" } } });
   * await app.register(swaggerUi, { routePrefix: "/documentation" });
   * await app.register(server.plugin());
   * ```
   */
  plugin(): FastifyPluginAsync {
    return async (fastify: FastifyInstance) => {
      // Register routes
      this.registerHealthRoute(fastify);
      this.registerWorkflowRoutes(fastify);
    };
  }

  private registerHealthRoute(fastify: FastifyInstance): void {
    const prefix = this.options.prefix;

    fastify.get<{
      Reply: HealthResponse;
    }>(
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
      async (_request, _reply) => {
        return { status: "ok" };
      },
    );
  }

  private registerWorkflowRoutes(fastify: FastifyInstance): void {
    const prefix = this.options.prefix;

    // GET /workflows - List all registered workflow names
    fastify.get<{
      Reply: string[];
    }>(
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
      async (_request, _reply) => {
        return this.getWorkflowNames();
      },
    );

    // POST /workflows/:name/run - Run workflow synchronously
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
              data: {
                description: "Data to pass to the start event",
              },
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
                result: {
                  description: "The result from the workflow",
                },
              },
              required: ["result"],
            },
            404: {
              type: "object",
              properties: {
                error: { type: "string" },
              },
              required: ["error"],
            },
            500: {
              type: "object",
              properties: {
                error: { type: "string" },
              },
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

        if (!this.workflows.has(name)) {
          return reply
            .status(404)
            .send({ error: `Workflow "${name}" not found` });
        }

        try {
          const result = await this.runWorkflow(name, data, timeout);
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
  }
}

/**
 * Create a new WorkflowServer instance.
 *
 * @param options - Server configuration options
 * @returns A new WorkflowServer instance
 */
export function createWorkflowServer(
  options?: WorkflowServerOptions,
): WorkflowServer {
  return new WorkflowServer(options);
}
