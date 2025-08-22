import { workflowEvent, createWorkflow } from "@llamaindex/workflow-core";
import { z } from "zod";
import { zodEvent } from "@llamaindex/workflow-core/util/zod";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";
import { pRetryHandler } from "@llamaindex/workflow-core/util/p-retry";

if (!process.env.LLAMA_CLOUD_API_KEY) {
  throw new Error("LLAMA_CLOUD_API_KEY is not set");
}

export const startEvent = zodEvent(
  z.object({
    inputFile: z.string().describe("input"),
    apiKey: z.string().describe("apiKey"),
  }),
);
const checkStatusEvent = workflowEvent<string>();
const checkStatusSuccessEvent = workflowEvent();
export const stopEvent = zodEvent(
  z.object({
    markdown: z.string().describe("markdown"),
  }),
);

type State = {
  apiKey: string;
};

const { withState } = createStatefulMiddleware<State>(() => ({
  apiKey: "",
}));

export const llamaParseWorkflow = withState(createWorkflow());

llamaParseWorkflow.handle(
  [startEvent],
  async (context, { data: { inputFile, apiKey } }) => {
    const { stream, sendEvent, state } = context;
    state.apiKey = apiKey;

    const { openAsBlob } = await import("node:fs");
    const blob = await openAsBlob(inputFile);
    const formData = new FormData();
    formData.append("file", blob);
    const { id } = await fetch(
      "https://api.cloud.llamaindex.ai/api/v1/parsing/upload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      },
    ).then((res) => res.json());
    sendEvent(checkStatusEvent.with(id));
    await stream.until(checkStatusSuccessEvent).toArray();
    return fetch(
      `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${id}/result/markdown`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    ).then(async (res) => stopEvent.with(await res.json()));
  },
);

llamaParseWorkflow.handle(
  [checkStatusEvent],
  pRetryHandler(
    async (context, { data: uuid }) => {
      const { status } = await fetch(
        `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${uuid}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${context.state.apiKey}`,
          },
        },
      ).then((res) => res.json());
      if (status === "SUCCESS") {
        return checkStatusSuccessEvent.with();
      }
      throw new Error(`LLamaParse status: ${status}`);
    },
    {
      retries: 100,
    },
  ),
);

const context = llamaParseWorkflow.createContext();

context.sendEvent(
  startEvent.with({
    inputFile: "sample.pdf",
    apiKey: process.env.LLAMA_CLOUD_API_KEY!,
  }),
);

const events = await context.stream.until(stopEvent).toArray();
console.log(events.map((e) => e.data));
