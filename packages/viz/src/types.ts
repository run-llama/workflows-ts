import type { WorkflowEvent } from "@llamaindex/workflow-core";

export type AcceptEventsType = WorkflowEvent<any>[];
export type ResultType = ReturnType<WorkflowEvent<any>["with"]> | void;
