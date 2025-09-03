import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import {
  otelTrace,
  withTraceEvents,
} from "@llamaindex/workflow-core/middleware/trace-events";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  // You can configure the exporter to your favorite backend (e.g. Jaeger, Honeycomb,...)
  traceExporter: new ConsoleSpanExporter(), // use ConsoleSpanExporter for demo purposes
  spanProcessor: new SimpleSpanProcessor(new ConsoleSpanExporter()),
});
sdk.start();

// Define workflow events
const startEvent = workflowEvent();
const stepEvent = workflowEvent<{ value: string }>();

// Create workflow with trace events support
const workflow = withTraceEvents(createWorkflow(), {
  plugins: [otelTrace],
});

// Add workflow handlers with tracing capabilities
workflow.handle([startEvent], (context) => {
  context.sendEvent(stepEvent.with({ value: "hello!" }));
  context.sendEvent(stepEvent.with({ value: "crash!" })); // will trigger error span
});

workflow.handle([stepEvent], (_, event) => {
  console.log("[Workflow] Handling stepEvent with value:", event.data.value);

  if (event.data.value === "crash!") {
    throw new Error("The ultimate error happened!");
  }
});

// Start the workflow and check the console output
// You can view OpenTelemetry console output such as information about your host, process, traceId, events, status, exceptions,...
const { sendEvent } = workflow.createContext();
sendEvent(startEvent.with());
