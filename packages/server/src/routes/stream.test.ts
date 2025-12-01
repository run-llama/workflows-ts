import { describe, expect, it, vi } from "vitest";
import type { StreamEvent } from "../types";
import {
  createStreamGenerator,
  formatCompletionEvent,
  formatEvent,
  formatEventAsNDJSON,
  formatEventAsSSE,
  parseStreamQueryParams,
  type StreamGeneratorDeps,
} from "./stream";

describe("parseStreamQueryParams", () => {
  it("should return default values when no query params provided", () => {
    const result = parseStreamQueryParams({});
    expect(result).toEqual({
      sse: true,
      acquireTimeout: 1,
      includeQualifiedName: true,
    });
  });

  it("should parse sse=false correctly", () => {
    const result = parseStreamQueryParams({ sse: "false" });
    expect(result.sse).toBe(false);
  });

  it("should parse sse=true correctly", () => {
    const result = parseStreamQueryParams({ sse: "true" });
    expect(result.sse).toBe(true);
  });

  it("should parse acquire_timeout correctly", () => {
    const result = parseStreamQueryParams({ acquire_timeout: "5" });
    expect(result.acquireTimeout).toBe(5);
  });

  it("should parse include_qualified_name=false correctly", () => {
    const result = parseStreamQueryParams({ include_qualified_name: "false" });
    expect(result.includeQualifiedName).toBe(false);
  });
});

describe("formatEventAsSSE", () => {
  it("should format event as SSE", () => {
    const event: StreamEvent = {
      type: "TestEvent",
      data: { message: "hello" },
      qualified_name: "TestEvent",
    };
    const result = formatEventAsSSE(event);
    expect(result).toBe(`data: ${JSON.stringify(event)}\n\n`);
  });

  it("should handle events with special characters", () => {
    const event: StreamEvent = {
      type: "TestEvent",
      data: { message: 'hello\nworld"test' },
    };
    const result = formatEventAsSSE(event);
    expect(result).toContain("data: ");
    expect(result.endsWith("\n\n")).toBe(true);
    // JSON.stringify handles the escaping
    expect(JSON.parse(result.slice(6, -2))).toEqual(event);
  });
});

describe("formatEventAsNDJSON", () => {
  it("should format event as NDJSON", () => {
    const event: StreamEvent = {
      type: "TestEvent",
      data: { message: "hello" },
    };
    const result = formatEventAsNDJSON(event);
    expect(result).toBe(`${JSON.stringify(event)}\n`);
  });
});

describe("formatEvent", () => {
  const event: StreamEvent = {
    type: "TestEvent",
    data: { value: 42 },
    qualified_name: "com.example.TestEvent",
  };

  it("should format as SSE when sse=true", () => {
    const result = formatEvent(event, {
      sse: true,
      includeQualifiedName: true,
    });
    expect(result).toContain("data: ");
    expect(result.endsWith("\n\n")).toBe(true);
  });

  it("should format as NDJSON when sse=false", () => {
    const result = formatEvent(event, {
      sse: false,
      includeQualifiedName: true,
    });
    expect(result).not.toContain("data: ");
    expect(result.endsWith("\n")).toBe(true);
  });

  it("should include qualified_name when includeQualifiedName=true", () => {
    const result = formatEvent(event, {
      sse: false,
      includeQualifiedName: true,
    });
    const parsed = JSON.parse(result);
    expect(parsed.qualified_name).toBe("com.example.TestEvent");
  });

  it("should exclude qualified_name when includeQualifiedName=false", () => {
    const result = formatEvent(event, {
      sse: false,
      includeQualifiedName: false,
    });
    const parsed = JSON.parse(result);
    expect(parsed.qualified_name).toBeUndefined();
  });
});

describe("formatCompletionEvent", () => {
  it("should format completion event with status and result", () => {
    const result = formatCompletionEvent("completed", { value: 42 }, undefined);
    const parsed = JSON.parse(result.slice(6, -2)); // Remove "data: " and "\n\n"
    expect(parsed.type).toBe("__stream_complete__");
    expect(parsed.status).toBe("completed");
    expect(parsed.result).toEqual({ value: 42 });
    expect(parsed.error).toBeUndefined();
  });

  it("should format completion event with error", () => {
    const result = formatCompletionEvent(
      "error",
      undefined,
      "Something went wrong",
    );
    const parsed = JSON.parse(result.slice(6, -2));
    expect(parsed.type).toBe("__stream_complete__");
    expect(parsed.status).toBe("error");
    expect(parsed.error).toBe("Something went wrong");
  });
});

describe("createStreamGenerator", () => {
  function createMockDeps(
    overrides: Partial<StreamGeneratorDeps> = {},
  ): StreamGeneratorDeps {
    return {
      getQueuedEvents: vi.fn(() => undefined),
      getHandlerStatus: vi.fn(() => undefined),
      getHandlerResult: vi.fn(() => undefined),
      releaseStreamLock: vi.fn(),
      pollInterval: 1, // Use minimal interval for tests
      ...overrides,
    };
  }

  it("should yield formatted events from queue", async () => {
    const events: StreamEvent[] = [
      { type: "Event1", data: { a: 1 } },
      { type: "Event2", data: { b: 2 } },
    ];

    let callCount = 0;
    const deps = createMockDeps({
      getQueuedEvents: vi.fn(() => {
        callCount++;
        if (callCount === 1) return events;
        return undefined;
      }),
      getHandlerStatus: vi.fn(() => {
        // Return "running" once, then "completed"
        return callCount === 1 ? "running" : "completed";
      }),
    });

    const generator = createStreamGenerator(
      "handler-1",
      { sse: true, includeQualifiedName: true },
      deps,
    );

    const results: string[] = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0]).toContain("Event1");
    expect(results[1]).toContain("Event2");
  });

  it("should stop streaming when handler is no longer running", async () => {
    const deps = createMockDeps({
      getQueuedEvents: vi.fn(() => undefined),
      getHandlerStatus: vi.fn(() => "completed"),
    });

    const generator = createStreamGenerator(
      "handler-1",
      { sse: true, includeQualifiedName: true },
      deps,
    );

    const results: string[] = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    // Should only have completion event
    expect(deps.getHandlerStatus).toHaveBeenCalled();
  });

  it("should release stream lock in finally block", async () => {
    const releaseLock = vi.fn();
    const deps = createMockDeps({
      getHandlerStatus: vi.fn(() => "completed"),
      releaseStreamLock: releaseLock,
    });

    const generator = createStreamGenerator(
      "handler-1",
      { sse: false, includeQualifiedName: true },
      deps,
    );

    for await (const _ of generator) {
      // consume generator
    }

    expect(releaseLock).toHaveBeenCalledWith("handler-1");
  });

  it("should send completion event only for SSE format", async () => {
    const deps = createMockDeps({
      getHandlerStatus: vi.fn(() => "completed"),
      getHandlerResult: vi.fn(() => ({ result: "done", error: undefined })),
    });

    // With SSE
    const sseGenerator = createStreamGenerator(
      "handler-1",
      { sse: true, includeQualifiedName: true },
      deps,
    );

    const sseResults: string[] = [];
    for await (const chunk of sseGenerator) {
      sseResults.push(chunk);
    }

    expect(sseResults.some((r) => r.includes("__stream_complete__"))).toBe(
      true,
    );

    // Without SSE
    const ndjsonGenerator = createStreamGenerator(
      "handler-2",
      { sse: false, includeQualifiedName: true },
      deps,
    );

    const ndjsonResults: string[] = [];
    for await (const chunk of ndjsonGenerator) {
      ndjsonResults.push(chunk);
    }

    expect(ndjsonResults.some((r) => r.includes("__stream_complete__"))).toBe(
      false,
    );
  });

  it("should use NDJSON format when sse=false", async () => {
    const events: StreamEvent[] = [{ type: "TestEvent", data: { x: 1 } }];

    let callCount = 0;
    const deps = createMockDeps({
      getQueuedEvents: vi.fn(() => {
        callCount++;
        return callCount === 1 ? events : undefined;
      }),
      getHandlerStatus: vi.fn(() =>
        callCount === 1 ? "running" : "completed",
      ),
    });

    const generator = createStreamGenerator(
      "handler-1",
      { sse: false, includeQualifiedName: true },
      deps,
    );

    const results: string[] = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    // NDJSON format should not have "data: " prefix
    expect(results[0]).not.toContain("data:");
    expect(results[0]?.endsWith("\n")).toBe(true);
  });
});
