import { OpenAI } from "openai";
import { createWorkflow, getExecutorContext, workflowEvent } from "fluere";
import { promiseHandler } from "fluere/interrupter/promise";
import {
  type ChatCompletionMessageToolCall,
  type ChatCompletionTool,
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

const startEvent = workflowEvent<string>();
const chatEvent = workflowEvent<string>();
const toolCallEvent = workflowEvent<ChatCompletionMessageToolCall>();
const toolCallResultEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();
const workflow = createWorkflow({
  startEvent,
  stopEvent,
});
workflow.handle([startEvent], async ({ data }) => {
  console.log("start event");
  const context = getExecutorContext();
  context.sendEvent(chatEvent(data));
});
workflow.handle([toolCallEvent], async () => {
  console.log("tool call event");
  return toolCallResultEvent("Today is sunny.");
});
workflow.handle([chatEvent], async ({ data }) => {
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
  const context = getExecutorContext();
  if (
    choices[0]?.message?.tool_calls?.length &&
    choices[0].message.tool_calls.length > 0
  ) {
    console.log("sending choices", choices[0].message.tool_calls);
    const result = (
      await Promise.all(
        choices[0].message.tool_calls.map(async (tool_call) => {
          context.sendEvent(toolCallEvent(tool_call));
          return context.requireEvent(toolCallResultEvent);
        }),
      )
    )
      .map(({ data }) => data)
      .join("\n");
    console.log("toolcall result", result);
    context.sendEvent(chatEvent(result));
    return await context.requireEvent(chatEvent);
  } else {
    console.log("no choices");
    return stopEvent(choices[0]!.message.content!);
  }
});

promiseHandler(
  workflow,
  startEvent("what is weather today, im in san francisco"),
).then(({ data }) => {
  console.log("AI response", data);
});
