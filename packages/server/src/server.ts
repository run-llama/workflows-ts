import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { WorkflowNotFoundError, WorkflowTimeoutError } from "./errors";
import { HandlerStore } from "./handler-store";
import {
  registerHandlerRoutes,
  registerHealthRoutes,
  registerWorkflowRoutes,
} from "./routes";
import type { HandlerStatus, WorkflowRunAsyncResponse } from "./schemas";
import type {
  RegisteredWorkflow,
  WorkflowConfig,
  WorkflowServerOptions,
} from "./types";

export {
  HandlerNotFoundError,
  WorkflowNotFoundError,
  WorkflowTimeoutError,
} from "./errors";

const DEFAULT_TIMEOUT = 30_000;

function generateHandlerId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * A map of workflow names to their configurations for initial registration.
 */
export type WorkflowsConfig = Record<string, WorkflowConfig>;

export class WorkflowServer {
  private workflows: Map<string, RegisteredWorkflow> = new Map();
  private _handlerStore: HandlerStore = new HandlerStore();
  private _options: Required<WorkflowServerOptions>;

  constructor(options: WorkflowServerOptions = {}) {
    this._options = {
      prefix: options.prefix ?? "",
    };
  }

  /**
   * Get the server options (read-only).
   */
  get options(): Readonly<Required<WorkflowServerOptions>> {
    return this._options;
  }

  /**
   * Get the handler store (for internal use).
   * @internal
   */
  get handlerStore(): HandlerStore {
    return this._handlerStore;
  }

  /**
   * Register a workflow with the server.
   * @param name - The unique name for this workflow
   * @param config - The workflow configuration including workflow, startEvent, and stopEvent
   */
  register<TStartData = unknown, TStopData = unknown>(
    name: string,
    config: WorkflowConfig<TStartData, TStopData>,
  ): this {
    if (this.workflows.has(name)) {
      throw new Error(`Workflow "${name}" is already registered`);
    }

    this.workflows.set(name, {
      ...config,
      name,
    });

    return this;
  }

  getWorkflow(name: string): RegisteredWorkflow | undefined {
    return this.workflows.get(name);
  }

  getWorkflowNames(): string[] {
    return Array.from(this.workflows.keys());
  }

  getHandler(handlerId: string) {
    return this._handlerStore.getInfo(handlerId);
  }

  getHandlers(filters?: { status?: HandlerStatus; workflowName?: string }) {
    return this._handlerStore.list(filters);
  }

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

  runWorkflowAsync(name: string, data: unknown): WorkflowRunAsyncResponse {
    const registered = this.workflows.get(name);
    if (!registered) {
      throw new WorkflowNotFoundError(name);
    }

    const handlerId = generateHandlerId();
    const { workflow, startEvent, stopEvent } = registered;
    const { stream, sendEvent } = workflow.createContext();

    this._handlerStore.create(handlerId, name, { stream } as never, sendEvent);

    sendEvent(startEvent.with(data));

    (async () => {
      try {
        for await (const event of stream) {
          if (stopEvent.include(event)) {
            this._handlerStore.updateStatus(handlerId, "completed", {
              result: event.data,
            });
            return;
          }
        }
        this._handlerStore.updateStatus(handlerId, "error", {
          error: "Workflow completed without stop event",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        this._handlerStore.updateStatus(handlerId, "error", { error: message });
      }
    })();

    return { handlerId, status: "running" };
  }
}

/**
 * Creates a Fastify plugin from a WorkflowServer instance.
 *
 * @example
 * ```ts
 * const workflowServer = createWorkflowServer({ ... });
 * await app.register(fastifyPlugin(workflowServer));
 * ```
 */
export function fastifyPlugin(server: WorkflowServer): FastifyPluginAsync {
  return async (fastify: FastifyInstance) => {
    const { prefix } = server.options;
    registerHealthRoutes(fastify, prefix);
    registerWorkflowRoutes(fastify, {
      prefix,
      getWorkflow: (name) => server.getWorkflow(name),
      getWorkflowNames: () => server.getWorkflowNames(),
      runWorkflow: (name, data, timeout) =>
        server.runWorkflow(name, data, timeout),
      runWorkflowAsync: (name, data) => server.runWorkflowAsync(name, data),
    });
    registerHandlerRoutes(fastify, {
      prefix,
      handlerStore: server.handlerStore,
    });
  };
}

/**
 * Creates a new WorkflowServer with optional initial workflow registrations.
 *
 * @example
 * ```ts
 * // Create with initial workflows
 * const server = createWorkflowServer({
 *   greeting: {
 *     workflow: greetingWorkflow,
 *     startEvent: greetStartEvent,
 *     stopEvent: greetStopEvent,
 *   },
 *   calculator: {
 *     workflow: calculatorWorkflow,
 *     startEvent: calcInputEvent,
 *     stopEvent: calcOutputEvent,
 *   },
 * });
 *
 * // Or create empty and register later
 * const server = createWorkflowServer();
 * server.register("greeting", { ... });
 * ```
 */
export function createWorkflowServer(
  workflows?: WorkflowsConfig,
  options?: WorkflowServerOptions,
): WorkflowServer {
  const server = new WorkflowServer(options);

  if (workflows) {
    for (const [name, config] of Object.entries(workflows)) {
      server.register(name, config);
    }
  }

  return server;
}
