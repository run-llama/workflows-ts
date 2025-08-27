import { createClient, createConfig } from "@hey-api/client-fetch";
import {
  createWorkflow,
  workflowEvent,
  type InferWorkflowEventData,
} from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";
import { withTraceEvents } from "@llamaindex/workflow-core/middleware/trace-events";
import { pRetryHandler } from "@llamaindex/workflow-core/util/p-retry";
import { zodEvent } from "@llamaindex/workflow-core/util/zod";
import hash from "stable-hash";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { getEnv } from "waku";
import { parseFormSchema } from "../schema";
import {
  type BodyUploadFileApiV1ParsingUploadPost,
  getJobApiV1ParsingJobJobIdGet,
  getJobJsonResultApiV1ParsingJobJobIdResultJsonGet,
  getJobResultApiV1ParsingJobJobIdResultMarkdownGet,
  getJobTextResultApiV1ParsingJobJobIdResultTextGet,
  type StatusEnum,
  uploadFileApiV1ParsingUploadPost,
} from "../lib/api";
import {
  checkStatusEvent,
  checkStatusSuccessEvent,
  requestMarkdownEvent,
  startEvent,
  markdownResultEvent,
  requestTextEvent,
  textResultEvent,
  requestJsonEvent,
  jsonResultEvent,
} from "./events";

export type LlamaParseWorkflowParams = {
  region?: "us" | "eu" | "us-staging";
  apiKey?: string;
};

const URLS = {
  us: "https://api.cloud.llamaindex.ai",
  eu: "https://api.cloud.eu.llamaindex.ai",
  "us-staging": "https://api.staging.llamaindex.ai",
} as const;

const { withState } = createStatefulMiddleware(
  (params: LlamaParseWorkflowParams) => {
    const apiKey = params.apiKey ?? getEnv("LLAMA_CLOUD_API_KEY");
    const region = params.region ?? "us";
    if (!apiKey) {
      throw new Error("LLAMA_CLOUD_API_KEY is not set");
    }
    return {
      cache: {} as Record<string, StatusEnum>,
      client: createClient(
        createConfig({
          baseUrl: URLS[region],
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }),
      ),
    };
  },
);

const llamaParseWorkflow = withState(withTraceEvents(createWorkflow()));

llamaParseWorkflow.handle([startEvent], async (context, { data: form }) => {
  const { state } = context;
  const finalForm = { ...form };
  if ("file" in form) {
    // support loads from the file system
    const file = form?.file;
    const isFilePath = typeof file === "string";
    const data = isFilePath ? await fs.readFile(file) : file;
    const filename: string | undefined = isFilePath
      ? path.basename(file)
      : undefined;
    finalForm.file = data
      ? globalThis.File && filename
        ? new File([data], filename)
        : new Blob([data])
      : undefined;
  }
  const {
    data: { id, status },
  } = await uploadFileApiV1ParsingUploadPost({
    throwOnError: true,
    body: {
      ...finalForm,
    } as BodyUploadFileApiV1ParsingUploadPost,
    client: state.client,
  });
  state.cache[id] = status;
  return checkStatusEvent.with(id);
});

llamaParseWorkflow.handle(
  [checkStatusEvent],
  pRetryHandler(
    async (context, { data: uuid }) => {
      const { state } = context;
      if (state.cache[uuid] === "SUCCESS") {
        return checkStatusSuccessEvent.with(uuid);
      }
      const {
        data: { status },
      } = await getJobApiV1ParsingJobJobIdGet({
        throwOnError: true,
        path: {
          job_id: uuid,
        },
        client: state.client,
      });
      state.cache[uuid] = status;
      if (status === "SUCCESS") {
        return checkStatusSuccessEvent.with(uuid);
      }
      throw new Error(`LLamaParse status: ${status}`);
    },
    {
      retries: 100,
    },
  ),
);

//#region sub workflow
llamaParseWorkflow.handle(
  [requestMarkdownEvent],
  async (context, { data: job_id }) => {
    const { state } = context;
    const { data } = await getJobResultApiV1ParsingJobJobIdResultMarkdownGet({
      throwOnError: true,
      path: {
        job_id,
      },
      client: state.client,
    });
    return markdownResultEvent.with(data.markdown);
  },
);

llamaParseWorkflow.handle(
  [requestTextEvent],
  async (context, { data: job_id }) => {
    const { state } = context;
    const { data } = await getJobTextResultApiV1ParsingJobJobIdResultTextGet({
      throwOnError: true,
      path: {
        job_id,
      },
      client: state.client,
    });
    return textResultEvent.with(data.text);
  },
);

llamaParseWorkflow.handle(
  [requestJsonEvent],
  async (context, { data: job_id }) => {
    const { state } = context;
    const { data } = await getJobJsonResultApiV1ParsingJobJobIdResultJsonGet({
      throwOnError: true,
      path: {
        job_id,
      },
      client: state.client,
    });
    return jsonResultEvent.with(data.pages);
  },
);
//#endregion

const cacheMap = new Map<
  string,
  ReturnType<typeof llamaParseWorkflow.createContext>
>();

export type ParseJob = {
  get jobId(): string;
  get signal(): AbortSignal;
  get context(): ReturnType<typeof llamaParseWorkflow.createContext>;
  get form(): InferWorkflowEventData<typeof startEvent>;

  markdown(): Promise<string>;
  text(): Promise<string>;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(): Promise<any[]>;
};

export const upload = async (
  params: InferWorkflowEventData<typeof startEvent> & LlamaParseWorkflowParams,
): Promise<ParseJob> => {
  //#region cache
  const key = hash({ apiKey: params.apiKey, region: params.region });
  if (!cacheMap.has(key)) {
    const context = llamaParseWorkflow.createContext(params);
    cacheMap.set(key, context);
  }
  //#endregion

  //#region upload event
  const context = cacheMap.get(key)!;
  const { stream, sendEvent } = context;
  const ev = startEvent.with(params);
  sendEvent(ev);

  const uploadThread = await llamaParseWorkflow
    .substream(ev, stream)
    .until((ev) => checkStatusSuccessEvent.include(ev))
    .toArray();
  //#region
  const jobId: string = uploadThread.at(-1)!.data;
  return {
    get signal() {
      // lazy load
      return context.signal;
    },
    get jobId() {
      return jobId;
    },
    get form() {
      return ev.data;
    },
    get context() {
      return context;
    },
    async markdown(): Promise<string> {
      const requestEv = requestMarkdownEvent.with(jobId);
      const { sendEvent, stream } = llamaParseWorkflow.createContext(params);
      sendEvent(requestEv);
      const markdownThread = await stream.until(markdownResultEvent).toArray();
      return markdownThread.at(-1)!.data;
    },
    async text(): Promise<string> {
      const requestEv = requestTextEvent.with(jobId);
      const { sendEvent, stream } = llamaParseWorkflow.createContext(params);
      sendEvent(requestEv);
      const textThread = await stream.until(textResultEvent).toArray();
      console.log("textThread", textThread);
      return textThread.at(-1)!.data;
    },
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    async json(): Promise<any[]> {
      const requestEv = requestJsonEvent.with(jobId);
      const { sendEvent, stream } = llamaParseWorkflow.createContext(params);
      sendEvent(requestEv);
      const jsonThread = await stream
        .until((ev) => jsonResultEvent.include(ev))
        .toArray();
      return jsonThread.at(-1)!.data;
    },
  };
};
