import type { WorkflowEvent } from "@llamaindex/workflow-core";

// biome-ignore lint/suspicious/noExplicitAny: simplify
export type AcceptEventsType = WorkflowEvent<any>[];
// biome-ignore lint/suspicious/noExplicitAny: simplify
// biome-ignore lint/suspicious/noConfusingVoidType: simplify
export type ResultType = ReturnType<WorkflowEvent<any>["with"]> | void;
