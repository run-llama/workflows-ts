import { OpenAI } from "openai";
import { createWorkflow, getContext, workflowEvent } from "@llamaindex/flow";
import type {
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions/completions";
import { consume } from "@llamaindex/flow/stream";

const llm = new OpenAI();
const tools = [
  {
    function: {
      name: "get_weather",
      description: "Get Weather Weather",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City and country e.g. Bogotá, Colombia",
          },
        },
        required: ["location"],
      },
    },
    type: "function",
  },
] satisfies ChatCompletionTool[];

const startEvent = workflowEvent<string>();
const chatEvent = workflowEvent<string>();
const toolCallEvent = workflowEvent<ChatCompletionMessageToolCall>();
const toolCallResultEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();
export const toolCallWorkflow = createWorkflow({
  startEvent,
  stopEvent,
});
toolCallWorkflow.handle([startEvent], async ({ data }) => {
  console.log("start event");
  const context = getContext();
  context.sendEvent(chatEvent(data));
});
toolCallWorkflow.handle([toolCallEvent], async () => {
  console.log("tool call event");
  return toolCallResultEvent("Today is sunny.");
});
toolCallWorkflow.handle([chatEvent], async ({ data }) => {
  console.log("chat event");
  const { choices } = await llm.chat.completions.create({
    model: "gpt-4-turbo",
    tools,
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant.",
      },
      {
        role: "user",
        content: data,
      },
    ],
  });
  const { sendEvent, stream } = getContext();
  if (
    choices[0]?.message?.tool_calls?.length &&
    choices[0].message.tool_calls.length > 0
  ) {
    console.log("sending choices", choices[0].message.tool_calls);
    const result = (
      await Promise.all(
        choices[0].message.tool_calls.map(async (tool_call) => {
          sendEvent(toolCallEvent(tool_call));
          return consume(stream, toolCallResultEvent);
        }),
      )
    )
      .map(({ data }) => data)
      .join("\n");
    console.log("toolcall result", result);
    sendEvent(chatEvent(result));
  } else {
    console.log("no choices");
    return stopEvent(choices[0]!.message.content!);
  }
});
