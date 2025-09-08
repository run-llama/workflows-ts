import type {
  Workflow,
  WorkflowEvent,
  WorkflowEventData,
} from "@llamaindex/workflow-core";
import type { NextRequest } from "next/server";
import { run } from "./stream/run";

type WorkflowAPI = {
  GET: (request: NextRequest) => Promise<Response>;
};

export const createNextHandler = <Start, Stop>(
  workflow: Workflow,
  getStart: (
    request: NextRequest,
  ) => WorkflowEventData<Start> | Promise<WorkflowEventData<Start>>,
  stop: WorkflowEvent<Stop>,
): WorkflowAPI => {
  return {
    GET: async (request) => {
      const result = await run(workflow, await getStart(request))
        .until(stop)
        .toArray();
      return Response.json(result.at(-1)!.data);
    },
  };
};
