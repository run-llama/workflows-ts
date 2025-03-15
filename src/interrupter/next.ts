import { NextRequest } from "next/server";
import { timeoutHandler } from "./timeout";
import type { Workflow } from "../core";

type WorkflowAPI = {
  GET: (request: NextRequest) => Promise<Response>;
};

export const createNextHandler = <Start, Stop>(
  workflow: Workflow<Start, Stop>,
): WorkflowAPI => {
  return {
    GET: async (request) => {
      const body = await request.json();
      const result = await timeoutHandler(() => workflow.run(body));
      return Response.json(result.data);
    },
  };
};
