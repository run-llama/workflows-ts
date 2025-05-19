import {
  type WorkflowEvent,
  WorkflowStream,
  type WorkflowEventData,
} from "@llama-flow/core";

export const createClient = (
  endpoint: string | URL,
  events: Record<string, WorkflowEvent<any>>,
) => {
  return {
    fetch: async (
      data: any,
      requestInit?: Omit<RequestInit, "body">,
    ): Promise<WorkflowStream<WorkflowEventData<any>>> => {
      const response = await fetch(endpoint, {
        ...requestInit,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...requestInit?.headers,
        },
        body: JSON.stringify(data),
      });
      return WorkflowStream.fromResponse(response, events);
    },
  };
};
