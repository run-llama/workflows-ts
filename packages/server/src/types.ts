import type {
  Workflow,
  WorkflowEvent,
  WorkflowEventData,
} from "@llamaindex/workflow-core";

export type {
  ErrorResponse,
  HandlerInfo,
  HandlerStatus,
  HealthResponse,
  WorkflowRunAsyncResponse,
  WorkflowRunRequest,
  WorkflowRunResponse,
} from "./schemas";

export interface WorkflowConfig<TStartData = unknown, TStopData = unknown> {
  workflow: Workflow;
  startEvent: WorkflowEvent<TStartData>;
  stopEvent: WorkflowEvent<TStopData>;
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
