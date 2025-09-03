import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { withTraceEvents } from "@llamaindex/workflow-core/middleware/trace-events";
import * as otelApi from "@opentelemetry/api";
import { SpanStatusCode, type Tracer } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";
import { openTelemetry } from "./decorator";

describe("otelTrace decorator", () => {
  it("should call the handler and record a successful span", () => {
    const startEvent = workflowEvent<{ value: string }>();
    const stopEvent = workflowEvent<{ value: string }>();
    const workflow = withTraceEvents(createWorkflow(), {
      plugins: [openTelemetry],
    });

    const startSpanMock = vi.fn().mockImplementation((name, opts, fn) => {
      return fn({
        end: vi.fn(),
        recordException: vi.fn(),
        setStatus: vi.fn(),
      });
    });

    vi.spyOn(otelApi.trace, "getTracer").mockReturnValue({
      startActiveSpan: startSpanMock,
    } as unknown as Tracer);

    workflow.handle([startEvent], (_, event) => {
      return stopEvent.with({ value: event.data.value });
    });

    const { sendEvent } = workflow.createContext();
    sendEvent(startEvent.with({ value: "test" }));
    expect(startSpanMock).toHaveBeenCalled();
  });

  it("should record exception for error in handler", () => {
    const startEvent = workflowEvent<{ value: string }>();
    const workflow = withTraceEvents(createWorkflow(), {
      plugins: [openTelemetry],
    });

    // Mocks for the span methods
    const recordExceptionMock = vi.fn();
    const setStatusMock = vi.fn();
    const endMock = vi.fn();

    // Properly mock startActiveSpan to call the handler
    const startActiveSpanMock = vi.fn().mockImplementation((name, fn) => {
      // fn is the callback passed by otelTrace
      return fn({
        end: endMock,
        recordException: recordExceptionMock,
        setStatus: setStatusMock,
      });
    });

    // Spy on getTracer to return our mocked tracer
    vi.spyOn(otelApi.trace, "getTracer").mockReturnValue({
      startActiveSpan: startActiveSpanMock,
    } as unknown as Tracer);

    // Add a handler with otelTrace that throws an error
    workflow.handle([startEvent], () => {
      throw new Error("fail");
    });

    // Send the event
    const { sendEvent } = workflow.createContext();
    sendEvent(startEvent.with({ value: "fail" }));

    // Assertions for span methods
    expect(recordExceptionMock).toHaveBeenCalled();
    expect(setStatusMock).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
    expect(endMock).toHaveBeenCalled();
  });
});
