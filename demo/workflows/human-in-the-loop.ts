import { withSnapshot, request } from "@llama-flow/core/middleware/snapshot";
import { createWorkflow, workflowEvent, getContext } from "@llama-flow/core";
import { OpenAI } from "openai";

export const serializableMemoryMap = new Map<string, any>();

const openai = new OpenAI();

const workflow = withSnapshot(createWorkflow());

const startEvent = workflowEvent<string>({
  debugLabel: "start",
});
const humanInteractionRequestEvent = workflowEvent<string>({
  debugLabel: "humanInteractionRequest",
});
const humanInteractionResponseEvent = workflowEvent<string>({
  debugLabel: "humanInteractionResponse",
});
type ResponseData =
  | {
      requestId: string;
      reason: string;
      data: string;
    }
  | {
      content: string;
    };
const stopEvent = workflowEvent<ResponseData>({
  debugLabel: "stop",
});

workflow.handle([startEvent], async ({ data }) => {
  const response = await openai.chat.completions.create({
    stream: false,
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant.
If user doesn't provide his/her name, call ask_name tool to ask for user's name.
Otherwise, analyze user's name with a good meaning and return the analysis.

For example, alex is from "Alexander the Great", who was a king of the ancient Greek kingdom of Macedon and one of history's greatest military minds.`,
      },
      {
        role: "user",
        content: data,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "ask_name",
          description: "Ask for user's name",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The message to ask for user's name",
              },
            },
            required: ["message"],
          },
        },
      },
    ],
  });
  const tools = response.choices[0].message.tool_calls;
  if (tools && tools.length > 0) {
    const askName = tools.find((tool) => tool.function.name === "ask_name");
    if (askName) {
      return humanInteractionRequestEvent.with(askName.function.arguments);
    }
  }
  return stopEvent.with({ content: response.choices[0].message.content! });
});

workflow.handle([humanInteractionRequestEvent], async (reason) => {
  const snapshot = await getContext().snapshot();
  const requestId = crypto.randomUUID();
  serializableMemoryMap.set(requestId, snapshot);
  return stopEvent.with({
    requestId: requestId,
    reason: reason,
    data: "request human in the loop",
  });
});

workflow.handle([humanInteractionResponseEvent], async ({ data }) => {
  const { sendEvent } = getContext();
  // data is the user's response - going back to the start event
  sendEvent(startEvent.with(data));
});

export {
  workflow,
  startEvent,
  humanInteractionRequestEvent,
  humanInteractionResponseEvent,
  stopEvent,
};
