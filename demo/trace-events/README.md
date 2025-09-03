# Trace Events Demo

This demo shows how to integrate **OpenTelemetry (OTel)** with LlamaIndex Workflows to trace workflow events, inspect spans, and capture errors.

## Prerequisites

Make sure you have the required dependencies installed:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/sdk-trace-base
```

## Running the OpenTelemetry Example

The `open-telemetry.ts` file demonstrates how to:

- Initialize OpenTelemetry with console span exporter
- Create a workflow with trace events support
- Handle workflow events with automatic tracing
- Capture errors and exceptions in spans

### Run the example:

```bash
npx tsx open-telemetry.ts
```

### What to expect:

When you run the example, you'll see structured JSON output in the console from the OpenTelemetry ConsoleSpanExporter. Each workflow span includes:

- **Trace ID**: Unique identifier for the workflow execution
- **Span ID**: Unique identifier for each workflow event handler execution
- **Attributes**: Metadata such as host info, process info, and custom tags
- **Status & Exceptions**: Captures any errors thrown in handlers (like the intentional "crash!" error)
- **Duration**: Time taken by each handler to execute

The example intentionally includes an error case (`crash!`) to demonstrate how exceptions are captured in the tracing output.

## Integration with Backend Services

You can easily modify the example to send traces to backend services like Jaeger, Honeycomb, or other OpenTelemetry-compatible platforms by changing the `traceExporter` configuration in the NodeSDK setup.

For more detailed examples and documentation, see the [tracing documentation](../../docs/workflows/common_patterns/tracing.mdx).
