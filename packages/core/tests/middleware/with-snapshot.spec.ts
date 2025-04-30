import { expect, test } from "vitest";
import { withSnapshot, request } from "@llama-flow/core/middleware/snapshot";
import { createWorkflow, workflowEvent } from "@llama-flow/core";

test("basic", () => {
  const workflow = withSnapshot(createWorkflow());
  const startEvent = workflowEvent();
  const humanResponseEvent = workflowEvent<string>();
  workflow.handle([startEvent], () => {
    return request(humanResponseEvent);
  });

  workflow.handle([humanResponseEvent], ({ data }) => {
    expect(data).toBe("hello world");
  });

  const { sendEvent, stream } = workflow.createContext();
  sendEvent(startEvent.with());
});
