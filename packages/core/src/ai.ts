import {
  createDataStream,
  formatDataStreamPart,
  type TextStreamPart,
  type Tool,
} from "ai";
import {
  getContext,
  workflowEvent,
  type WorkflowEventData,
} from "@llama-flow/core";
// @ts-expect-error
import type {
  JSONValue,
  ToolCall,
  ToolResult,
  LanguageModelV1FinishReason,
  LanguageModelV1Source,
} from "@ai-sdk/ui-utils/dist/index";

// predefined events from AI SDK
const textEvent = workflowEvent<string, "text">({ debugLabel: "text" });
const dataEvent = workflowEvent<JSONValue[], "data">({ debugLabel: "data" });
const errorEvent = workflowEvent<string, "error">({ debugLabel: "error" });
const messageAnnotationsEvent = workflowEvent<
  JSONValue[],
  "message_annotations"
>({ debugLabel: "message_annotations" });
const toolCallEvent = workflowEvent<ToolCall<string, any>, "tool_call">({
  debugLabel: "tool_call",
});
const toolResultEvent = workflowEvent<
  Omit<ToolResult<string, any, any>, "args" | "toolName">,
  "tool_result"
>({ debugLabel: "tool_result" });
const toolCallStreamingStartEvent = workflowEvent<
  { toolCallId: string; toolName: string },
  "tool_call_streaming_start"
>({ debugLabel: "tool_call_streaming_start" });
const toolCallDeltaEvent = workflowEvent<
  { toolCallId: string; argsTextDelta: string },
  "tool_call_delta"
>({ debugLabel: "tool_call_delta" });
const finishMessageEvent = workflowEvent<
  {
    finishReason: LanguageModelV1FinishReason;
    usage?: { promptTokens: number; completionTokens: number };
  },
  "finish_message"
>({ debugLabel: "finish_message" });
const finishStepEvent = workflowEvent<
  {
    isContinued: boolean;
    finishReason: LanguageModelV1FinishReason;
    usage?: { promptTokens: number; completionTokens: number };
  },
  "finish_step"
>({ debugLabel: "finish_step" });
const startStepEvent = workflowEvent<{ messageId: string }, "start_step">({
  debugLabel: "start_step",
});
const reasoningEvent = workflowEvent<string, "reasoning">({
  debugLabel: "reasoning",
});
const sourceEvent = workflowEvent<LanguageModelV1Source, "source">({
  debugLabel: "source",
});
const redactedReasoningEvent = workflowEvent<
  { data: string },
  "redacted_reasoning"
>({ debugLabel: "redacted_reasoning" });
const reasoningSignatureEvent = workflowEvent<
  { signature: string },
  "reasoning_signature"
>({ debugLabel: "reasoning_signature" });
const fileEvent = workflowEvent<{ data: string; mimeType: string }, "file">({
  debugLabel: "file",
});

export const aiEvents = {
  text: textEvent,
  data: dataEvent,
  error: errorEvent,
  messageAnnotations: messageAnnotationsEvent,
  toolCall: toolCallEvent,
  toolResult: toolResultEvent,
  toolCallStreamingStart: toolCallStreamingStartEvent,
  toolCallDelta: toolCallDeltaEvent,
  finishMessage: finishMessageEvent,
  finishStep: finishStepEvent,
  startStep: startStepEvent,
  reasoning: reasoningEvent,
  source: sourceEvent,
  redactedReasoning: redactedReasoningEvent,
  reasoningSignature: reasoningSignatureEvent,
  file: fileEvent,
} as const;

export async function mergeToWorkflow(
  dataStream: AsyncIterable<TextStreamPart<Record<string, Tool>>> &
    ReadableStream<TextStreamPart<Record<string, Tool>>>,
) {
  const { sendEvent } = getContext();
  await dataStream.pipeTo(
    new WritableStream({
      write: async (part) => {
        switch (part.type) {
          case "text-delta":
            sendEvent(textEvent.with(part.textDelta));
            break;
          case "reasoning":
            sendEvent(reasoningEvent.with(part.textDelta));
            break;
          case "reasoning-signature":
            sendEvent(
              reasoningSignatureEvent.with({ signature: part.signature }),
            );
            break;
          case "redacted-reasoning":
            sendEvent(redactedReasoningEvent.with({ data: part.data }));
            break;
          case "source":
            sendEvent(sourceEvent.with(part.source));
            break;
          case "file":
            sendEvent(
              fileEvent.with({ data: part.base64, mimeType: part.mimeType }),
            );
            break;
          case "tool-call":
            sendEvent(toolCallEvent.with(part));
            break;
          case "tool-call-streaming-start":
            sendEvent(
              toolCallStreamingStartEvent.with({
                toolCallId: part.toolCallId,
                toolName: part.toolName,
              }),
            );
            break;
          case "tool-call-delta":
            sendEvent(
              toolCallDeltaEvent.with({
                toolCallId: part.toolCallId,
                argsTextDelta: part.argsTextDelta,
              }),
            );
            break;
          case "step-start":
            sendEvent(startStepEvent.with({ messageId: part.messageId }));
            break;
          case "step-finish":
            sendEvent(
              finishStepEvent.with({
                isContinued: part.isContinued,
                finishReason: part.finishReason,
                usage: part.usage,
              }),
            );
            break;
          case "finish":
            sendEvent(
              finishMessageEvent.with({
                finishReason: part.finishReason,
                usage: part.usage,
              }),
            );
            break;
          case "error":
            sendEvent(errorEvent.with(String(part.error)));
            break;
          default:
            // Unknown part type, ignore or handle as needed
            break;
        }
      },
    }),
  );
}

export const dataStream = (stream: ReadableStream<WorkflowEventData<any>>) => {
  return createDataStream({
    execute: async (dataStream) => {
      await stream.pipeTo(
        new WritableStream({
          write: (event) => {
            if (textEvent.include(event)) {
              dataStream.write(formatDataStreamPart("text", event.data));
            } else if (dataEvent.include(event)) {
              dataStream.write(formatDataStreamPart("data", event.data));
            } else if (errorEvent.include(event)) {
              dataStream.write(formatDataStreamPart("error", event.data));
            } else if (messageAnnotationsEvent.include(event)) {
              dataStream.write(
                formatDataStreamPart("message_annotations", event.data),
              );
            } else if (toolCallEvent.include(event)) {
              dataStream.write(formatDataStreamPart("tool_call", event.data));
            } else if (toolResultEvent.include(event)) {
              dataStream.write(formatDataStreamPart("tool_result", event.data));
            } else if (toolCallStreamingStartEvent.include(event)) {
              dataStream.write(
                formatDataStreamPart("tool_call_streaming_start", event.data),
              );
            } else if (toolCallDeltaEvent.include(event)) {
              dataStream.write(
                formatDataStreamPart("tool_call_delta", event.data),
              );
            } else if (finishMessageEvent.include(event)) {
              dataStream.write(
                formatDataStreamPart("finish_message", event.data),
              );
            } else if (finishStepEvent.include(event)) {
              dataStream.write(formatDataStreamPart("finish_step", event.data));
            } else if (startStepEvent.include(event)) {
              dataStream.write(formatDataStreamPart("start_step", event.data));
            } else if (reasoningEvent.include(event)) {
              dataStream.write(formatDataStreamPart("reasoning", event.data));
            } else if (sourceEvent.include(event)) {
              dataStream.write(formatDataStreamPart("source", event.data));
            } else if (redactedReasoningEvent.include(event)) {
              dataStream.write(
                formatDataStreamPart("redacted_reasoning", event.data),
              );
            } else if (reasoningSignatureEvent.include(event)) {
              dataStream.write(
                formatDataStreamPart("reasoning_signature", event.data),
              );
            } else if (fileEvent.include(event)) {
              dataStream.write(formatDataStreamPart("file", event.data));
            }
          },
        }),
      );
    },
  });
};
