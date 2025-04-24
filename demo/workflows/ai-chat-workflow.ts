import { createWorkflow, workflowEvent } from "@llama-flow/core";
import { mergeToWorkflow } from "@llama-flow/core/ai";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

const chatWorkflow = createWorkflow();

const startChatEvent = workflowEvent<string>();
const stopChatEvent = workflowEvent();

chatWorkflow.handle([startChatEvent], async () => {
  const result = streamText({
    model: openai("gpt-4.1"),
    prompt: "You are a helpful assistant.",
  });
  await mergeToWorkflow(result.fullStream);
  return stopChatEvent.with();
});

export { startChatEvent, stopChatEvent, chatWorkflow };
