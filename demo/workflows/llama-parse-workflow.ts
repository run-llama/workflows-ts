import { workflowEvent, createWorkflow } from "fluere";
import { z } from "zod";
import { zodEvent } from "fluere/util/zod";
import { getContext } from "fluere";
import { withStore } from "fluere/util/store";
import { pRetryHandler } from "fluere/util/p-retry";

const startEvent = zodEvent(
  z.object({
    inputFile: z.string().describe("input"),
    apiKey: z.string().describe("apiKey"),
  }),
);
const checkStatusEvent = workflowEvent<string>();
const checkStatusSuccessEvent = workflowEvent();
const stopEvent = zodEvent(
  z.object({
    markdown: z.string().describe("markdown"),
  }),
);

export const llamaParseWorkflow = withStore(
  {} as {
    apiKey: string;
  },
  createWorkflow({
    startEvent,
    stopEvent,
  }),
);

llamaParseWorkflow.handle(
  [startEvent],
  async ({ data: { inputFile, apiKey } }) => {
    llamaParseWorkflow.getContext().apiKey = apiKey;
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
    getContext().sendEvent(checkStatusEvent(id));
    await getContext().requireEvent(checkStatusSuccessEvent);
    return fetch(
      `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${id}/result/markdown`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    ).then(async (res) => stopEvent(await res.json()));
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
            Authorization: `Bearer ${llamaParseWorkflow.getContext().apiKey}`,
          },
        },
      ).then((res) => res.json());
      if (status === "SUCCESS") {
        return checkStatusSuccessEvent();
      }
      throw new Error(`LLamaParse status: ${status}`);
    },
    {
      retries: 100,
    },
  ),
);
