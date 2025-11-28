import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { WorkflowNotFoundError, WorkflowTimeoutError } from "./errors";
import { HandlerStore } from "./handler-store";
import {
  registerHandlerRoutes,
  registerHealthRoutes,
  registerWorkflowRoutes,
} from "./routes";
import type {
  RegisteredWorkflow,
  WorkflowConfig,
  WorkflowRunAsyncResponse,
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

export class WorkflowServer {
  private workflows: Map<string, RegisteredWorkflow> = new Map();
  private handlerStore: HandlerStore = new HandlerStore();
  private options: Required<WorkflowServerOptions>;

  constructor(options: WorkflowServerOptions = {}) {
    this.options = {
      prefix: options.prefix ?? "",
    };
  }

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

  getHandler(handlerId: string) {
    return this.handlerStore.getInfo(handlerId);
  }

  getHandlers(filters?: {
    status?: "running" | "completed" | "error" | "cancelled";
    workflowName?: string;
  }) {
    return this.handlerStore.list(filters);
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

    this.handlerStore.create(handlerId, name, { stream } as never, sendEvent);

    sendEvent(startEvent.with(data));

    (async () => {
      try {
        for await (const event of stream) {
          if (stopEvent.include(event)) {
            this.handlerStore.updateStatus(handlerId, "completed", {
              result: event.data,
            });
            return;
          }
        }
        this.handlerStore.updateStatus(handlerId, "error", {
          error: "Workflow completed without stop event",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        this.handlerStore.updateStatus(handlerId, "error", { error: message });
      }
    })();

    return { handlerId, status: "running" };
  }

  plugin(): FastifyPluginAsync {
    return async (fastify: FastifyInstance) => {
      registerHealthRoutes(fastify, this.options.prefix);
      registerWorkflowRoutes(fastify, {
        prefix: this.options.prefix,
        getWorkflow: (name) => this.getWorkflow(name),
        getWorkflowNames: () => this.getWorkflowNames(),
        runWorkflow: (name, data, timeout) =>
          this.runWorkflow(name, data, timeout),
        runWorkflowAsync: (name, data) => this.runWorkflowAsync(name, data),
      });
      registerHandlerRoutes(fastify, {
        prefix: this.options.prefix,
        handlerStore: this.handlerStore,
      });
    };
  }
}

export function createWorkflowServer(
  options?: WorkflowServerOptions,
): WorkflowServer {
  return new WorkflowServer(options);
}
