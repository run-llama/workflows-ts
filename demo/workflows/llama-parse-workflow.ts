import { workflowEvent, createWorkflow } from "@llama-flow/core";
import { until } from "@llama-flow/core/stream/until";
import { nothing } from "@llama-flow/core/stream/consumer";
import { z } from "zod";
import { zodEvent } from "@llama-flow/core/util/zod";
import { createStatefulMiddleware } from "@llama-flow/core/middleware/state";
import { pRetryHandler } from "@llama-flow/core/util/p-retry";

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

const { withState, getContext } = createStatefulMiddleware(
  () =>
    ({}) as {
      apiKey: string;
    },
);

export const llamaParseWorkflow = withState(createWorkflow());

llamaParseWorkflow.handle(
  [startEvent],
  async ({ data: { inputFile, apiKey } }) => {
    getContext().state.apiKey = apiKey;
    const { stream, sendEvent } = getContext();
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
    await nothing(until(stream, checkStatusSuccessEvent));
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
    async ({ data: uuid }) => {
      const { status } = await fetch(
        `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${uuid}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getContext().state.apiKey}`,
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
