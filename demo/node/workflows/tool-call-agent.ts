import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { OpenAI } from "openai";
import type {
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions/completions";

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

export const startEvent = workflowEvent<string>();
const chatEvent = workflowEvent<string>();
const toolCallEvent = workflowEvent<ChatCompletionMessageToolCall>();
const toolCallResultEvent = workflowEvent<string>();
export const stopEvent = workflowEvent<string>();
export const toolCallWorkflow = createWorkflow();
toolCallWorkflow.handle([startEvent], async (context, { data }) => {
  console.log("start event");
  context.sendEvent(chatEvent.with(data));
});
toolCallWorkflow.handle([toolCallEvent], async () => {
  console.log("tool call event");
  return toolCallResultEvent.with("Today is sunny.");
});
toolCallWorkflow.handle([chatEvent], async (context, { data }) => {
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
  const { sendEvent, stream } = context;
  if (
    choices[0]?.message?.tool_calls?.length &&
    choices[0].message.tool_calls.length > 0
  ) {
    console.log("sending choices", choices[0].message.tool_calls);
    const result = (
      await Promise.all(
        choices[0].message.tool_calls.map(async (tool_call) => {
          sendEvent(toolCallEvent.with(tool_call));
          return stream.until(toolCallResultEvent).toArray();
        }),
      )
    )
      .map((list) => list.at(-1))
      .filter((event) => event !== undefined)
      .map(({ data }) => data)
      .join("\n");
    console.log("toolcall result", result);
    sendEvent(chatEvent.with(result));
  } else {
    console.log("no choices");
    return stopEvent.with(choices[0]?.message.content ?? "");
  }
});
