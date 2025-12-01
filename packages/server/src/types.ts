import type {
  Workflow,
  WorkflowEvent,
  WorkflowEventData,
} from "@llamaindex/workflow-core";

export type {
  CancelQuery,
  CancelResponse,
  ErrorResponse,
  EventSchema,
  HandlerInfo,
  HandlerStatus,
  HealthResponse,
  SendEventRequest,
  SendEventResponse,
  StreamEvent,
  StreamQuery,
  WorkflowEventsResponse,
  WorkflowRunAsyncResponse,
  WorkflowRunRequest,
  WorkflowRunResponse,
  WorkflowSchemaResponse,
} from "./schemas";

export type WorkflowEventWithSchema<T = unknown> = WorkflowEvent<T> & {
  readonly schema?: unknown;
};

export interface WorkflowConfig<TStartData = unknown, TStopData = unknown> {
  workflow: Workflow;
  startEvent: WorkflowEvent<TStartData>;
  stopEvent: WorkflowEvent<TStopData>;
  /**
   * Additional events that can be sent to this workflow.
   * These are used for event schema generation and sending events to running workflows.
   */
  additionalEvents?: WorkflowEvent<unknown>[];
}

export interface WorkflowServerOptions {
  prefix?: string;
}

export interface RegisteredWorkflow<TStartData = unknown, TStopData = unknown>
  extends WorkflowConfig<TStartData, TStopData> {
  name: string;
}

export type ExtractEventData<T> = T extends WorkflowEventData<infer D>
  ? D
  : never;
