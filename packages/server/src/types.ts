import type {
  Workflow,
  WorkflowEvent,
  WorkflowEventData,
} from "@llamaindex/workflow-core";

/**
 * Configuration for a registered workflow.
 */
export interface WorkflowConfig<TStartData = unknown, TStopData = unknown> {
  /**
   * The workflow instance to register.
   */
  workflow: Workflow;

  /**
   * The event that starts the workflow.
   */
  startEvent: WorkflowEvent<TStartData>;

  /**
   * The event that signals the workflow has completed.
   */
  stopEvent: WorkflowEvent<TStopData>;
}

/**
 * Options for creating a WorkflowServer.
 */
export interface WorkflowServerOptions {
  /**
   * Base path prefix for all workflow routes.
   * @default ""
   */
  prefix?: string;
}

/**
 * Handler status type.
 */
export type HandlerStatus = "running" | "completed" | "error" | "cancelled";

/**
 * Information about a running or completed workflow handler.
 */
export interface HandlerInfo {
  /**
   * Unique identifier for the handler.
   */
  handlerId: string;

  /**
   * Name of the workflow being executed.
   */
  workflowName: string;

  /**
   * Current status of the handler.
   */
  status: HandlerStatus;

  /**
   * Timestamp when the workflow started.
   */
  startedAt: Date;

  /**
   * Timestamp when the workflow completed (if completed).
   */
  completedAt?: Date;

  /**
   * The result data (if completed).
   */
  result?: unknown;

  /**
   * Error message (if error).
   */
  error?: string;
}

/**
 * Response for health check endpoint.
 */
export interface HealthResponse {
  status: "ok";
}

/**
 * Response for workflow run endpoint.
 */
export interface WorkflowRunResponse<TResult = unknown> {
  result: TResult;
}

/**
 * Request body for workflow run endpoint.
 */
export interface WorkflowRunRequest<TData = unknown> {
  /**
   * Data to pass to the start event.
   */
  data: TData;

  /**
   * Optional timeout in milliseconds for sync run.
   * @default 30000
   */
  timeout?: number;
}

/**
 * Response for run-nowait endpoint.
 */
export interface WorkflowRunAsyncResponse {
  handlerId: string;
  status: "running";
}

/**
 * Internal type for registered workflow with metadata.
 */
export interface RegisteredWorkflow<TStartData = unknown, TStopData = unknown>
  extends WorkflowConfig<TStartData, TStopData> {
  name: string;
}

/**
 * Extract the data type from a WorkflowEventData.
 */
export type ExtractEventData<T> = T extends WorkflowEventData<infer D>
  ? D
  : never;
