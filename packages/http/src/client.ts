import {
  type WorkflowEvent,
  type WorkflowEventData,
  WorkflowStream,
} from "@llamaindex/workflow-core";

export const createClient = (
  endpoint: string | URL,
  events: Record<string, WorkflowEvent<any>>,
) => {
  return {
    fetch: async (
      data: Record<string, any>,
      requestInit?: Omit<RequestInit, "body">,
    ): Promise<WorkflowStream<WorkflowEventData<any>>> => {
      const form = new FormData();
      for (const key in data) {
        if (data[key] instanceof File) {
          form.append(key, data[key]);
        } else {
          form.append(key, JSON.stringify(data[key]));
        }
      }
      const response = await fetch(endpoint, {
        ...requestInit,
        method: "POST",
        headers: {
          ...requestInit?.headers,
        },
        body: form,
      });
      return WorkflowStream.fromResponse(response, events);
    },
  };
};
