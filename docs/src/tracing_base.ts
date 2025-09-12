import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { withTraceEvents } from "@llamaindex/workflow-core/middleware/trace-events";
import { openTelemetry } from "@llamaindex/workflow-otel";

import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";

// Initialize OpenTelemetry SDK (use your preferred exporter in real deployments)
const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  spanProcessor: new SimpleSpanProcessor(new ConsoleSpanExporter()),
});
sdk.start();

// Define events
const startEvent = workflowEvent();
export const stepEvent = workflowEvent<{ value: string }>();

// Create workflow and attach the OpenTelemetry plugin
export const workflow = withTraceEvents(createWorkflow(), {
  plugins: [openTelemetry],
});

// Handlers automatically produce spans (including errors)
workflow.handle([startEvent], (context) => {
  context.sendEvent(stepEvent.with({ value: "hello!" }));
  context.sendEvent(stepEvent.with({ value: "crash!" })); // demonstrates error spans
});

workflow.handle([stepEvent], (_context, event) => {
  if (event.data.value === "crash!") {
    throw new Error("The ultimate error happened!");
  }
});

// Run
const { sendEvent, stream } = workflow.createContext();
sendEvent(startEvent.with());
