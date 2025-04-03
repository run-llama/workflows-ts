import { NextRequest } from "next/server";
import type { Workflow, WorkflowEventData, WorkflowEvent } from "fluere";
import { promiseHandler } from "./promise";

type WorkflowAPI = {
  GET: (request: NextRequest) => Promise<Response>;
};

export const createNextHandler = <Start, Stop>(
  workflow: Workflow<Start, Stop>,
  getStart: (
    request: NextRequest,
  ) => WorkflowEventData<Start> | Promise<WorkflowEventData<Start>>,
  stop: WorkflowEvent<Stop>,
): WorkflowAPI => {
  return {
    GET: async (request) => {
      const result = await promiseHandler(
        workflow,
        await getStart(request),
        stop,
      );
      return Response.json(result.data);
    },
  };
};
