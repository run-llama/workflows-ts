import { NextRequest } from "next/server";
import type {
  Workflow,
  WorkflowEventData,
  WorkflowEvent,
} from "@llama-flow/core";
import { runWorkflow } from "./stream/run";

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
      const result = await runWorkflow(workflow, await getStart(request), stop);
      return Response.json(result.data);
    },
  };
};
